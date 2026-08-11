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

/// Leser en JSON-array-TEXT-kolonne tilbake til en `serde_json::Value`, med
/// tomt array (`[]`) som fallback for `NULL`/manglende rad ELLER ugyldig
/// lagret JSON. Brukes for felt som semantisk alltid er arrays (leader_ids,
/// locked_ids, student_ids, pairs, stations, groups, group_leaders,
/// rotation_plan) - alle har enten et `DEFAULT '[]'`-skjema eller blir alltid
/// skrevet via `encode_json_field` over, så et tomt array er den korrekte
/// "ingenting her ennå"-tilstanden (i motsetning til `Value::Null`, som
/// classes.rs/rooms.rs/seatings.rs sine felt bruker som fallback siden de
/// IKKE alltid er arrays).
pub fn decode_json_field(raw: Option<String>) -> Value {
  match raw {
    None => Value::Array(Vec::new()),
    Some(s) => serde_json::from_str(&s).unwrap_or_else(|_| Value::Array(Vec::new())),
  }
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

  #[test]
  fn decode_none_defaults_to_empty_array() {
    assert_eq!(decode_json_field(None), Value::Array(Vec::new()));
  }

  #[test]
  fn decode_valid_json_parses_to_value() {
    assert_eq!(
      decode_json_field(Some("[1,2,3]".to_string())),
      serde_json::json!([1, 2, 3])
    );
  }

  #[test]
  fn decode_invalid_json_defaults_to_empty_array() {
    assert_eq!(
      decode_json_field(Some("not json".to_string())),
      Value::Array(Vec::new())
    );
  }
}
