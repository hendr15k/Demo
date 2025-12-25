# Bio-Programme: Kampf um CPU-Zyklen

Eine browserbasierte Simulation von selbst-replizierenden Programmen, die um Speicherplatz und CPU-Zyklen kämpfen. Programme evolvieren durch zufällige Bit-Flips beim Kopieren.

[Demo Starten](index.html) (Öffnen Sie diese Datei in Ihrem Browser)

## Übersicht

Die Simulation besteht aus einer Virtuellen Maschine (VM) mit einer benutzerdefinierten Befehlssatzarchitektur (ISA). Programme (Organismen) befinden sich in einem gemeinsamen Speicherraum (4096 Bytes).

*   **Speicher**: Lineares Array von 32-Bit-Integern. Visualisiert als 64x64-Raster.
*   **Prozesse**: Unabhängige Ausführungs-Threads (Programme). Jeder hat einen Befehlszeiger (IP) und 4 Register.
*   **Wettbewerb**: Prozesse konkurrieren um Speicherplatz. Das Überschreiben des Speichers eines anderen Programms tötet oder korrumpiert es.
*   **Evolution**: Wenn ein Programm in den Speicher schreibt, besteht eine kleine Chance (Mutationsrate) für einen Bit-Flip. Dies verändert Befehle und kann zu neuen Verhaltensweisen führen.

## Funktionen

*   **Verschiedene Spezies**: Wählen Sie aus verschiedenen Startorganismen mit unterschiedlichen Strategien:
    *   *Basic Replicator*: Eine einfache Schleife, die sich selbst kopiert. Sie ist weniger optimiert und größer als der Smart Loop, dient aber als guter Ausgangspunkt.
    *   *Smart Loop*: Ein kompakter Replikator, der eine selbst-zurücksetzende Schleife verwendet. Er ist robuster und effizienter.
    *   *Hyper Replicator*: Eine hochentwickelte Spezies mit einer "Unrolled Loop"-Strategie. Sie kopiert zwei Wörter pro Iteration und verwendet eine Split-Loop-Technik, um Pointer-Überläufe zu vermeiden. Schneller, aber komplexer.
    *   *Killer (Predator)*: Nutzt die Smart-Loop-Engine, trägt aber eine "giftige" Fracht, die `DIE`-Befehle an zufällige Speicherorte schreibt, bevor sie repliziert.
    *   *Fortress (Defender)*: Eine defensive Variante, die einen Schutzwall aus `DIE`-Befehlen um sich herum aufbaut (-1 und +30 relative Distanz), um Angreifer abzuwehren, bevor sie repliziert.
*   **Visueller Speicher**: Sehen Sie das Speicherlayout in Echtzeit. Farben repräsentieren verschiedene Abstammungslinien.
*   **Inspektion**: Klicken Sie auf ein beliebiges Pixel im Raster, um den Befehl an dieser Adresse zu untersuchen.
*   **Statistiken**: Verfolgen Sie aktive Prozesse, Gesamtzyklen, erreichte maximale Generation und Gesamtmutationen.
*   **Populationsgraph**: Echtzeit-Visualisierung der Anzahl aktiver Prozesse.
*   **Random Soup**: Starten Sie eine "Ursuppe" mit zufälligem Speicherinhalt und zufälligen Prozessen, um zu sehen, ob Leben spontan entsteht (oder zumindest interessante Muster).
*   **Steuerung**: Anpassbare Geschwindigkeit, Mutationsrate, Pause/Weiter und Reset.

## Befehlssatzarchitektur (ISA)

Jeder Befehl ist ein 32-Bit-Wort, das Folgendes enthält:
*   **Opcode** (4 Bits): Die auszuführende Operation.
*   **ModeA** (2 Bits), **ValA** (12 Bits): Erster Operand.
*   **ModeB** (2 Bits), **ValB** (12 Bits): Zweiter Operand.

### Adressierungsmodi
*   `0` **IMMEDIATE**: Der Wert `Val`.
*   `1` **RELATIVE**: Speicher an `IP + Val`.
*   `2` **REGISTER**: Register `Reg[Val % 4]`.
*   `3` **REG_INDIRECT**: Speicher an der absoluten Adresse, die in `Reg[Val % 4]` gespeichert ist.

### Opcodes
| Opcode | Mnemonic | Beschreibung |
| :--- | :--- | :--- |
| 0 | `NOP` | Keine Operation. |
| 1 | `MOV A, B` | Kopiere Wert A nach Ziel B. |
| 2 | `ADD A, B` | Addiere A zum Ziel B. |
| 3 | `SUB A, B` | Subtrahiere A vom Ziel B. |
| 4 | `JMP A` | Springe zu Adresse A (relativ). |
| 5 | `JZ A, B` | Springe zu A, wenn B Null ist. |
| 6 | `JNZ A, B` | Springe zu A, wenn B nicht Null ist. |
| 7 | `SPWN A` | Erzeuge einen neuen Prozess an Adresse A. |
| 8 | `SEQ A, B` | Überspringe den nächsten Befehl, wenn A == B. |
| 9 | `SNE A, B` | Überspringe den nächsten Befehl, wenn A != B. |
| 10 | `RAND B` | Speichere einen Zufallswert (0-4095) in B. |
| 15 | `DIE` | Beende den aktuellen Prozess. |

## Ausführung

1.  Klonen Sie das Repository.
2.  Öffnen Sie `index.html` in einem modernen Webbrowser.
3.  Wählen Sie eine Startspezies (z.B. "Smart Loop").
4.  Klicken Sie auf "Start", um die Simulation zu beginnen.

## Steuerung

*   **Start**: Startet die Simulationsschleife.
*   **Pause**: Stoppt die Simulation.
*   **Reset**: Löscht den Speicher und startet neu mit einer frischen Instanz der gewählten Spezies.
*   **Random Soup**: Startet die Simulation mit zufälligem Speicherinhalt.
*   **Species Select**: Wählen Sie den Organismus, der beim Reset injiziert werden soll.
*   **Speed**: Passt die Anzahl der VM-Zyklen pro Frame an.
*   **Mutation**: Passt die Wahrscheinlichkeit für Bit-Flips an (0% bis 10%). Der aktuelle Wert wird neben dem Schieberegler angezeigt.
*   **Canvas Click**: Klicken Sie auf das Raster, um die Befehlsdetails in der Infobox unten zu sehen.

## Entwicklung

Die Kernlogik befindet sich in `script.js`. Sie ist so konzipiert, dass sie sowohl im Browser als auch in Node.js (für Tests) funktioniert.

Tests ausführen:
```bash
node test_vm.js
node test_rand.js
```
