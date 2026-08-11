pub mod commands;
pub mod db;
pub mod pdf_export;
pub mod schema;

use std::sync::Mutex;
use tauri::Manager;

use commands::app_info::{get_migration_info, get_version};
use commands::classes::{delete_class, get_class, get_classes, save_class};
use commands::constraints::get_constraints;
use commands::db_maintenance::{backup_db, move_db, restore_db};
use commands::groups::{
  delete_group_assignment, get_group_assignment, get_group_assignment_groups,
  get_group_assignments, get_group_history, save_group_assignment, save_group_history,
};
use commands::print_export::export_seating_chart_pdf;
use commands::rooms::{delete_room, get_room, get_rooms, save_room};
use commands::seatings::{delete_seating, get_seating, get_seatings, save_seating};
use commands::settings::{get_settings, save_settings};
use commands::stations::{
  delete_station_session, get_station_session, get_station_sessions, save_station_session,
};

// Spike-command for Task 0.2: verifiserer at printpdf kan generere en lesbar PDF,
// kalt fra frontend via Tauri sin invoke-bro. Midlertidig - forenkles/utvides i Fase 6.
#[tauri::command]
fn spike_pdf(path: String) -> Result<(), String> {
  pdf_export::spike_generate_test_pdf(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      spike_pdf,
      get_classes,
      get_class,
      save_class,
      delete_class,
      get_rooms,
      get_room,
      save_room,
      delete_room,
      get_seatings,
      get_seating,
      save_seating,
      delete_seating,
      get_constraints,
      get_group_assignments,
      get_group_assignment,
      save_group_assignment,
      delete_group_assignment,
      get_group_assignment_groups,
      get_group_history,
      save_group_history,
      get_station_sessions,
      get_station_session,
      save_station_session,
      delete_station_session,
      get_settings,
      save_settings,
      get_version,
      get_migration_info,
      backup_db,
      restore_db,
      move_db,
      export_seating_chart_pdf
    ])
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
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

      app.manage(db::CurrentDbPathState(Mutex::new(db_path)));
      app.manage(db::DbState(Mutex::new(conn)));

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
