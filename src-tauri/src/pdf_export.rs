//! Spike (Task 0.2): verify that `printpdf` can generate a readable PDF from Rust.
//!
//! This is intentionally minimal — a proof that the crate works and is callable
//! from a Tauri command. The real seating-chart PDF rendering logic is built in
//! Fase 6 (Task 6.1-6.3), not here.
//!
//! Page size matches today's Electron print output: A4 landscape (297 x 210 mm),
//! per `src/styles/print.css` (`@page { size: A4 landscape; margin: 0; }` and the
//! `.seating-chart-print` element sized to `297mm x 210mm`).

use printpdf::*;
use std::fs::File;
use std::io::BufWriter;

pub fn spike_generate_test_pdf(path: &str) -> Result<(), String> {
    let (doc, page1, layer1) = PdfDocument::new("Klassekart", Mm(297.0), Mm(210.0), "Layer 1");
    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    layer.use_text("Testbord 1", 14.0, Mm(20.0), Mm(190.0), &font);

    doc.save(&mut BufWriter::new(
        File::create(path).map_err(|e| e.to_string())?,
    ))
    .map_err(|e| e.to_string())?;
    Ok(())
}
