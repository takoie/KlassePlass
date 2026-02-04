import sqlite3
import os

# OPPDATERT FILNAVN
db_file = "klassekart_database.db"

def create_database():
    if os.path.exists(db_file):
        os.remove(db_file)
        print(f"🗑️  Fjernet gammel {db_file}")

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    # Tabell for KLASSER
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            students TEXT  -- Lagrer elevliste som en JSON-lignende streng eller linjeseparert
        )
    ''')

    # Tabell for ROM
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            layout_data TEXT -- Lagrer JSON med bordplasseringer
        )
    ''')

    # Tabell for KLASSEKART (Koblingen mellom rom, klasse og plasseringer)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS seatings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            class_id INTEGER,
            room_id INTEGER,
            placements TEXT, -- JSON med hvem som sitter hvor
            comment TEXT,
            FOREIGN KEY(class_id) REFERENCES classes(id),
            FOREIGN KEY(room_id) REFERENCES rooms(id)
        )
    ''')

    print(f"✅ Ny database opprettet: {db_file}")
    
    # Legg inn litt testdata (Valgfritt)
    cursor.execute("INSERT INTO classes (name, students) VALUES (?, ?)", 
                   ("10A", "Ola Nordmann\nKari Olsen\nPer Hansen"))
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    create_database()