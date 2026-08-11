pub mod db;
pub mod pdf_export;
pub mod schema;

use std::sync::Mutex;
use tauri::Manager;

// Spike-command for Task 0.2: verifiserer at printpdf kan generere en lesbar PDF,
// kalt fra frontend via Tauri sin invoke-bro. Midlertidig - forenkles/utvides i Fase 6.
#[tauri::command]
fn spike_pdf(path: String) -> Result<(), String> {
  pdf_export::spike_generate_test_pdf(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![spike_pdf])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let user_data_dir = app.path().app_data_dir()?;
      let db_path = db::resolve_db_path(&user_data_dir);
      let conn = db::open_connection(&db_path)?;

      // Back up the on-disk file BEFORE running any migrations, since those
      // mutate the file in place. See db::backup_before_migrate_if_needed
      // for the exact "from_version > 0 && from_version < target" guard.
      let from_version = db::get_schema_version(&conn);
      let backup_path =
        db::backup_before_migrate_if_needed(&db_path, from_version, schema::CURRENT_VERSION)?;

      let migration_info = backup_path.map(|backup_path| db::MigrationInfo {
        from_version,
        to_version: schema::CURRENT_VERSION,
        backup_path,
      });
      app.manage(db::MigrationInfoState(Mutex::new(migration_info)));

      schema::run_migrations(&conn)?;
      schema::migrate_room_layouts(&conn)?;

      app.manage(db::DbState(Mutex::new(conn)));

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
