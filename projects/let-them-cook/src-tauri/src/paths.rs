//! OneDrive / FACTTT layout discovery.
//! Reimplemented in BLADE style — no runtime dependency on BLADE_Alpha.

use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

const APP_FOLDER: &str = "FACTTT";
const PREFERRED_ONEDRIVE: &str = "OneDrive - USTSA";
const INITIATIVES_FILE: &str = "initiatives.json";
pub const APP_TITLE: &str = "Let Them Cook";

pub fn get_operator() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "OPERATOR".to_string())
}

pub fn user_profile_dir() -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("USERPROFILE") {
        let path = PathBuf::from(p);
        if !path.as_os_str().is_empty() {
            return Ok(path);
        }
    }
    if let Ok(p) = std::env::var("HOME") {
        let path = PathBuf::from(p);
        if !path.as_os_str().is_empty() {
            return Ok(path);
        }
    }
    Ok(PathBuf::from(format!(r"C:\Users\{}", get_operator())))
}

/// Prefer `OneDrive - USTSA`, else the first `OneDrive*` folder under the profile.
pub fn find_onedrive_root_from(profile: &Path) -> Result<PathBuf, String> {
    let preferred = profile.join(PREFERRED_ONEDRIVE);
    if preferred.is_dir() {
        return Ok(preferred);
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = fs::read_dir(profile) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            if name.starts_with("OneDrive") {
                candidates.push(path);
            }
        }
    }
    candidates.sort();
    candidates
        .into_iter()
        .next()
        .ok_or_else(|| {
            format!(
                "Could not find OneDrive. Looked for '{}' then any OneDrive* folder under {}.",
                PREFERRED_ONEDRIVE,
                profile.display()
            )
        })
}

pub fn find_onedrive_root() -> Result<PathBuf, String> {
    find_onedrive_root_from(&user_profile_dir()?)
}

fn facttt_env_override() -> Option<PathBuf> {
    std::env::var("FACTTT_ROOT")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
}

/// If the running exe lives under a folder named FACTTT, use that folder.
fn facttt_from_exe() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    for ancestor in exe.ancestors() {
        if ancestor
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.eq_ignore_ascii_case(APP_FOLDER))
        {
            return Some(ancestor.to_path_buf());
        }
    }
    None
}

/// FACTTT root: env override, else exe dropped into FACTTT, else OneDrive/FACTTT (created).
pub fn find_app_root() -> Result<PathBuf, String> {
    if let Some(root) = facttt_env_override() {
        fs::create_dir_all(&root).map_err(|e| format!("Cannot create FACTTT_ROOT: {e}"))?;
        return Ok(root);
    }
    if let Some(root) = facttt_from_exe() {
        return Ok(root);
    }
    let onedrive = find_onedrive_root()?;
    let app = onedrive.join(APP_FOLDER);
    fs::create_dir_all(&app).map_err(|e| format!("Cannot create {}: {e}", app.display()))?;
    Ok(app)
}

pub fn data_dir(app_root: &Path) -> PathBuf {
    app_root.join("data")
}
pub fn inbox_dir(app_root: &Path) -> PathBuf {
    app_root.join("inbox")
}
pub fn archive_dir(app_root: &Path) -> PathBuf {
    app_root.join("archive")
}
pub fn initiatives_path(app_root: &Path) -> PathBuf {
    data_dir(app_root).join(INITIATIVES_FILE)
}

pub fn ensure_share_layout_at(app_root: &Path) -> Result<PathBuf, String> {
    for dir in [data_dir(app_root), inbox_dir(app_root), archive_dir(app_root)] {
        fs::create_dir_all(&dir).map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;
    }
    let path = initiatives_path(app_root);
    if !path.exists() {
        write_json_atomic(&path, &starter_initiatives())?;
    }
    Ok(app_root.to_path_buf())
}

pub fn starter_initiatives() -> Value {
    json!({
        "version": 1,
        "updatedAt": Value::Null,
        "updatedBy": Value::Null,
        "items": [],
        "sharedNotes": "",
        "meta": {
            "app": APP_TITLE
        },
        "schema": "let-them-cook-dashboard",
        "schemaVersion": "2.0.0",
        "exportedAt": Value::Null,
        "exportedBy": Value::Null,
        "source": "LetThemCook.exe",
        "intendedFolderDisplayName": "OneDrive - USTSA\\FACTTT",
        "initiatives": []
    })
}

pub fn read_dashboard_at(app_root: &Path) -> Result<Value, String> {
    ensure_share_layout_at(app_root)?;
    let path = initiatives_path(app_root);
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    serde_json::from_str(&raw)
        .map_err(|e| format!("initiatives.json is not valid JSON ({}): {e}", path.display()))
}

pub fn safe_operator(name: &str) -> String {
    let mapped: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = mapped.trim_matches('_');
    let slice: String = trimmed.chars().take(40).collect();
    if slice.is_empty() {
        "OPERATOR".to_string()
    } else {
        slice
    }
}

/// Filesystem-safe UTC stamp: 2026-09-18T16-02-05Z
pub fn iso_ts_file() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H-%M-%SZ").to_string()
}

pub fn iso_ts_now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

pub fn write_dashboard_at(app_root: &Path, mut payload: Value) -> Result<PathBuf, String> {
    ensure_share_layout_at(app_root)?;
    let operator = payload
        .get("updatedBy")
        .or_else(|| payload.get("exportedBy"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(get_operator);
    let now = iso_ts_now();
    payload["updatedBy"] = json!(operator);
    payload["exportedBy"] = json!(operator);
    payload["updatedAt"] = json!(now);
    payload["exportedAt"] = json!(now);
    payload["version"] = json!(1);
    if payload.get("schema").is_none() {
        payload["schema"] = json!("let-them-cook-dashboard");
    }
    let dest = initiatives_path(app_root);
    write_json_atomic(&dest, &payload)?;
    Ok(dest)
}

pub fn write_submit_at(app_root: &Path, mut payload: Value) -> Result<PathBuf, String> {
    ensure_share_layout_at(app_root)?;
    let operator = payload
        .get("updatedBy")
        .or_else(|| payload.get("exportedBy"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(get_operator);

    if payload.get("updatedBy").is_none() {
        payload["updatedBy"] = json!(operator);
    }
    if payload.get("exportedBy").is_none() {
        payload["exportedBy"] = json!(operator);
    }
    let now = iso_ts_now();
    if payload.get("updatedAt").and_then(|v| v.as_str()).is_none() {
        payload["updatedAt"] = json!(now);
    }
    if payload.get("exportedAt").and_then(|v| v.as_str()).is_none() {
        payload["exportedAt"] = json!(now);
    }

    let filename = format!(
        "submit-{}-{}.json",
        iso_ts_file(),
        safe_operator(&operator)
    );
    let dest = inbox_dir(app_root).join(filename);
    write_json_atomic(&dest, &payload)?;
    Ok(dest)
}

pub fn write_json_atomic(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create {}: {e}", parent.display()))?;
    }
    let pretty = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Cannot serialize JSON: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, pretty.as_bytes())
        .map_err(|e| format!("Cannot write {}: {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Cannot finalize {}: {e}", path.display())
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_root() -> PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!("ltc-facttt-test-{n}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn prefers_ustsa_onedrive() {
        let profile = temp_root();
        fs::create_dir_all(profile.join("OneDrive")).unwrap();
        fs::create_dir_all(profile.join("OneDrive - USTSA"));
        let found = find_onedrive_root_from(&profile).unwrap();
        assert_eq!(found.file_name().unwrap(), "OneDrive - USTSA");
    }

    #[test]
    fn falls_back_to_first_onedrive_star() {
        let profile = temp_root();
        fs::create_dir_all(profile.join("OneDrive - Contoso")).unwrap();
        fs::create_dir_all(profile.join("OneDrive")).unwrap();
        let found = find_onedrive_root_from(&profile).unwrap();
        let name = found.file_name().unwrap().to_string_lossy();
        assert!(name.starts_with("OneDrive"));
    }

    #[test]
    fn ensure_creates_layout_and_starter_initiatives() {
        let root = temp_root().join("FACTTT");
        ensure_share_layout_at(&root).unwrap();
        assert!(data_dir(&root).is_dir());
        assert!(inbox_dir(&root).is_dir());
        assert!(archive_dir(&root).is_dir());
        let path = initiatives_path(&root);
        assert!(path.exists());
        let parsed: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(parsed["meta"]["app"], APP_TITLE);
        assert_eq!(parsed["schema"], "let-them-cook-dashboard");
        assert!(parsed.get("master").is_none());
        assert!(!path.file_name().unwrap().to_string_lossy().contains("master"));
        assert!(parsed["initiatives"].is_array());
    }

    #[test]
    fn write_submit_does_not_rewrite_initiatives() {
        let root = temp_root().join("FACTTT");
        ensure_share_layout_at(&root).unwrap();
        let original = fs::read_to_string(initiatives_path(&root)).unwrap();
        let path = write_submit_at(
            &root,
            json!({
                "schema": "let-them-cook-dashboard",
                "sharedNotes": "hello from test",
                "updatedBy": "Jane Doe"
            }),
        )
        .unwrap();
        assert!(path.starts_with(inbox_dir(&root)));
        let name = path.file_name().unwrap().to_string_lossy();
        assert!(name.starts_with("submit-"));
        assert!(name.contains("Jane_Doe"));
        assert!(name.ends_with(".json"));
        let after = fs::read_to_string(initiatives_path(&root)).unwrap();
        assert_eq!(original, after, "initiatives.json must be unchanged on submit");
        assert!(!name.contains("master"));
    }

    #[test]
    fn write_dashboard_replaces_share_file() {
        let root = temp_root().join("FACTTT");
        ensure_share_layout_at(&root).unwrap();
        let dest = write_dashboard_at(
            &root,
            json!({
                "schema": "let-them-cook-dashboard",
                "sharedNotes": "persisted note",
                "updatedBy": "Jane Doe",
                "initiatives": [
                    {
                        "id": "1",
                        "templateId": "default",
                        "name": "Test Initiative",
                        "status": "active",
                        "sections": []
                    }
                ]
            }),
        )
        .unwrap();
        assert_eq!(dest, initiatives_path(&root));
        let parsed: Value =
            serde_json::from_str(&fs::read_to_string(&dest).unwrap()).unwrap();
        assert_eq!(parsed["sharedNotes"], "persisted note");
        assert_eq!(parsed["updatedBy"], "Jane Doe");
        assert_eq!(parsed["initiatives"][0]["name"], "Test Initiative");
        assert!(parsed.get("master").is_none());
    }

    #[test]
    fn safe_operator_strips_path_chars() {
        assert_eq!(safe_operator(r"a\b/c:d"), "a_b_c_d");
        assert_eq!(safe_operator("   "), "OPERATOR");
    }
}
