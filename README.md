# Bio-Programme: Kampf um CPU-Zyklen

Eine browserbasierte Simulation von selbst-replizierenden Programmen, die um Speicherplatz und CPU-Zyklen kämpfen. Programme evolvieren durch zufällige Bit-Flips beim Kopieren und zeigen interessante evolutionäre Verhaltensweisen.

[Demo Starten](index.html) (Öffnen Sie diese Datei in Ihrem Browser)

## Übersicht

Die Simulation besteht aus einer Virtuellen Maschine (VM) mit einer benutzerdefinierten Befehlssatzarchitektur (ISA). Programme (Organismen) befinden sich in einem gemeinsamen Speicherraum (4096 Bytes).

*   **Speicher**: Lineares Array von 32-Bit-Integern. Visualisiert als 64x64-Raster.
*   **Prozesse**: Unabhängige Ausführungs-Threads (Programme). Jeder hat einen Befehlszeiger (IP) und 4 Register.
*   **Wettbewerb**: Prozesse konkurrieren um Speicherplatz. Das Überschreiben des Speichers eines anderen Programms tötet oder korrumpiert es.
*   **Evolution**:
    *   **Mutation**: Wenn ein Programm in den Speicher schreibt, besteht eine kleine Chance (Mutationsrate) für einen Bit-Flip.
    *   **Farbevolution**: Kinder erben die Farbe ihrer Eltern mit einer leichten Variation des Farbtons. Dies ermöglicht die visuelle Nachverfolgung von Abstammungslinien.

## Funktionen

*   **Verschiedene Spezies**:
    *   *Basic Replicator*: Eine einfache Schleife, die sich selbst kopiert.
    *   *Smart Loop*: Ein kompakter, robuster Replikator.
    *   *Hyper Replicator*: Eine hochentwickelte Spezies mit "Unrolled Loop" und "Split-Loop"-Technik für maximale Effizienz.
    *   *Killer (Räuber)*: Basiert auf Smart Loop, schreibt aber zufällige Daten in den Speicher, bevor er repliziert.
    *   *Fortress (Verteidiger)*: Baut einen Schutzwall aus `DIE`-Befehlen um sich herum auf.
*   **Visueller Speicher**: Echtzeit-Raster. Klicken Sie auf Pixel, um Befehle zu inspizieren.
*   **Populationsgraph**: Visualisierung der Anzahl aktiver Prozesse über die Zeit.
*   **Ursuppe (Random Soup)**: Starten Sie mit zufälligem Speicherinhalt, um spontane Entstehung von Replikatoren zu beobachten.
*   **Maximales Alter**: Legen Sie eine Lebensspanne für Prozesse fest, um alten Code automatisch zu bereinigen und Evolution zu beschleunigen.
*   **Speichern/Laden**: Exportieren und Importieren Sie den kompletten Simulationszustand als JSON-Datei.
*   **Steuerung**: Geschwindigkeit, Mutationsrate, Pause/Schritt/Reset.

## Bedienung

1.  Öffnen Sie `index.html` in einem modernen Webbrowser.
2.  Wählen Sie eine Startspezies (z.B. "Smart Loop").
3.  Klicken Sie auf **Start**, um die Simulation zu beginnen.

### Steuerelemente

*   **Start**: Startet die Simulation.
*   **Pause**: Pausiert die Simulation.
*   **Schritt**: Führt einen einzelnen Simulationsschritt aus (nur im Pausenmodus). Nützlich zur Analyse.
*   **Reset**: Löscht alles und startet neu.
*   **Ursuppe**: Startet mit zufälligem Speicher.
*   **Geschwindigkeit**: Regelt die VM-Zyklen pro Frame.
*   **Mutation**: Regelt die Bit-Flip-Wahrscheinlichkeit.
*   **Max Alter**: Begrenzt die Lebensdauer eines Prozesses (0 = Unendlich). Ältere Prozesse sterben automatisch.
*   **Save/Load**: Speichert den aktuellen Zustand in eine Datei oder lädt einen Zustand.

## Technische Details

Die Simulation läuft in `script.js` und implementiert eine eigene VM.

### Befehlssatz (Auszug)
Jeder Befehl ist 32-Bit: Opcode (4), ModeA (2), ValA (12), ModeB (2), ValB (12).
Wichtige Opcodes: `MOV`, `ADD`, `SUB`, `JMP`, `JZ`, `SPWN` (Neuer Prozess), `DIE` (Prozess beenden), `RAND`.

### Tests
Für die Entwicklung können Node.js-Tests ausgeführt werden:
```bash
node test_vm.js
```
