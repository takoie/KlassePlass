// Delt returtype for `save_*`-kommandoene som speiler Electron-originalens
// `dbRun`-hjelper (`src/ipc-handlers.js`), som ALLTID returnerte
// `{ lastID: <number>, changes: 1 }` etter en vellykket INSERT/UPDATE
// (node-sqlite3/sql.js-konvensjon: `this.lastID`/`this.changes` på et
// statement-resultat).
//
// De porterte Tauri-commandsene returnerte opprinnelig en bar `i64` (kun
// radens id), noe som brøt ALLE frontend-kallsteder som destrukturerer
// `result?.lastID` (merk uvanlig kapitalisering - IKKE `lastId`) for å
// avgjøre om de skal navigere inn i/velge den nyopprettede/oppdaterte raden.
// Se docs/plans/2026-08-11-tauri-migrasjon-oppfolgingspunkter.md punkt 1 for
// full kontekst rundt oppdagelsen.
//
// `changes` var i JS-originalen ALLTID hardkodet til `1` ved suksess -
// IKKE et reelt `changes()`-tall fra SQLite. Siden ingen kjente
// frontend-kallsteder grener på selve `changes`-verdien (kun på `lastID`s
// sannhetsverdi), speiler vi denne hardkodingen bevisst i stedet for å
// "forbedre" den til et reelt endrings-antall.
use serde::Serialize;

#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
pub struct SaveResult {
  #[serde(rename = "lastID")]
  pub last_id: i64,
  pub changes: i64,
}

impl SaveResult {
  /// Bygger et `SaveResult` for en vellykket insert/update - `changes` er
  /// alltid `1`, speiler JS-originalens hardkoding (se modul-doc).
  pub fn new(last_id: i64) -> Self {
    Self { last_id, changes: 1 }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn serializes_with_capitalized_last_id_key() {
    let result = SaveResult::new(42);
    let json = serde_json::to_value(result).unwrap();
    assert_eq!(json, serde_json::json!({"lastID": 42, "changes": 1}));
  }

  #[test]
  fn new_always_sets_changes_to_one() {
    assert_eq!(SaveResult::new(0).changes, 1);
    assert_eq!(SaveResult::new(999).changes, 1);
  }
}
