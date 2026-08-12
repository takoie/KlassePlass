// Delt hjelper for JSON-array-TEXT-kolonner som ALLTID stringifies friskt fra
// bunnen av, i motsetning til `students`/`layout_data`/`placements`-mønsteret
// i classes.rs/rooms.rs/seatings.rs som har en streng-passthrough for
// allerede-serialiserte verdier (`typeof x === 'string' ? x : JSON.stringify(x)`).
//
// JS-originalen for feltene denne modulen dekker (leader_ids, locked_ids,
// student_ids, pairs, stations, groups, group_leaders, rotation_plan) gjør
// ALLTID `JSON.stringify(value ?? [])` ubetinget - det finnes IKKE noen
// `typeof x === 'string'`-sjekk for disse feltene noe sted i kildekoden. Ikke
// gjenbruk encode_students/encode_layout_data/encode_placements-mønsteret
// (streng-passthrough) på disse feltene - det ville være å oppfinne en
// oppførsel JS-originalen ikke har.
//
// Denne modulen ble trukket ut i Task 2.2 batch 2 (groups.rs, stations.rs)
// etter en kodegjennomgangs-merknad fra batch 1 om at
// decode_placements/decode_layout_data/decode_students var nesten identiske
// kopier på tvers av 3 filer. Retrofitting av classes.rs/rooms.rs/seatings.rs
// til å bruke denne er bevisst IKKE gjort her - de er allerede
// gjennomgått/committet, og churn uten funksjonell gevinst der veies ikke opp
// mot risikoen. Nytt kode i dette og fremtidige batches bør bruke denne.
//
// VIKTIG (decode_json_field FJERNET): Denne modulen hadde tidligere en
// `decode_json_field`-funksjon som PARSET den lagrede TEXT-kolonnen til en
// `serde_json::Value` på LESE-veien (get_group_assignment(s)/
// get_group_assignment_groups/get_group_history/get_station_session(s) i
// groups.rs/stations.rs). Det var samme bug-klasse som ble fikset for
// `students`/`layout_data`/`placements` i classes.rs/rooms.rs/seatings.rs:
// frontend kaller ubetinget `JSON.parse(...)` på disse feltene (f.eks.
// `JSON.parse(assignment.leader_ids || '[]')` i GroupEditor.jsx,
// `JSON.parse(s.stations || '[]')` i StationPresenter.jsx), og et allerede
// parset objekt/array fikk `JSON.parse` til å kaste en TypeError - fanget av
// frontendens egen try/catch og stille erstattet med en tom liste, selv om
// dataen lå trygt lagret i databasen. Lese-veien i groups.rs/stations.rs
// bruker nå rå `Option<String>` direkte fra `row.get(...)`, uten noen
// decode-wrapper. `encode_json_field` (under) er en SEPARAT, korrekt
// SKRIVE-vei-funksjon og er UENDRET av denne fiksen.
use serde_json::Value;

/// Speiler JS sin ubetingede `JSON.stringify(value ?? [])`: `None` (feltet var
/// fraværende/null i payloaden) blir til et tomt array FØR serialisering -
/// ALDRI streng-passthrough, uansett hva `value` inneholder (heller ikke om
/// det tilfeldigvis er en `Value::String`).
pub fn encode_json_field(value: Option<&Value>) -> String {
  let owned;
  let v: &Value = match value {
    Some(v) => v,
    None => {
      owned = Value::Array(Vec::new());
      &owned
    }
  };
  serde_json::to_string(v).expect("serialisering av serde_json::Value kan ikke feile")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn encode_none_defaults_to_empty_array() {
    assert_eq!(encode_json_field(None), "[]");
  }

  #[test]
  fn encode_array_serializes_directly() {
    let v = serde_json::json!([1, 2, 3]);
    assert_eq!(encode_json_field(Some(&v)), "[1,2,3]");
  }

  #[test]
  fn encode_does_not_passthrough_string_values() {
    // I motsetning til encode_students/encode_layout_data/encode_placements:
    // en Value::String skal serialiseres FRISKT (med anførselstegn og
    // escaping), ALDRI brukes som streng-innhold direkte.
    let v = Value::String(r#"["Alice","Bob"]"#.to_string());
    assert_eq!(encode_json_field(Some(&v)), r#""[\"Alice\",\"Bob\"]""#);
  }
}
