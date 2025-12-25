# Bio-Programme: Kampf um CPU-Zyklen und Speicher

Willkommen zu **Bio-Programme**, einer browserbasierten Simulation künstlichen Lebens. In dieser virtuellen Umgebung konkurrieren selbst-replizierende Computerprogramme um begrenzten Speicherplatz und Rechenzeit. Sie kämpfen ums Überleben, vermehren sich und evolvieren durch zufällige Mutationen.

[Demo Starten](index.html) (Öffnen Sie diese Datei in Ihrem Browser)

## 🧬 Wie es funktioniert

Die Simulation basiert auf einer "Core War"-ähnlichen Arena (einem gemeinsamen Speicherblock), in dem mehrere Programme gleichzeitig ausgeführt werden.

### Die Virtuelle Maschine (VM)
*   **Speicher**: Ein Ringpuffer aus 4096 Speicherzellen (32-Bit Integer).
*   **Prozesse**: Jedes Programm ist ein Prozess mit einem Befehlszeiger (Instruction Pointer) und 4 Registern.
*   **Ausführung**: Die VM verteilt CPU-Zyklen reihum an alle aktiven Prozesse.

### Evolution
*   **Replikation**: Programme müssen ihren eigenen Code in einen neuen Speicherbereich kopieren und dort einen neuen Prozess starten (`SPWN`).
*   **Mutation**: Bei jedem Schreibzugriff in den Speicher gibt es eine kleine Chance (`Mutationsrate`), dass ein Bit kippt. Dies kann Programme zerstören, aber auch neue, effizientere Varianten hervorbringen.
*   **Selektion**: Programme, die schneller kopieren oder besser verteidigen, verdrängen andere.

## 🚀 Funktionen

*   **Visueller Speicher**: Beobachten Sie den Kampf in Echtzeit auf einem 64x64 Raster.
*   **Spezies-Auswahl**: Wählen Sie aus verschiedenen vordefinierten Organismen:
    *   *Basic Replicator*: Einfach und verständlich.
    *   *Smart Loop*: Optimiert und kompakt.
    *   *Hyper Replicator*: Hochentwickelt, nutzt "Unrolled Loops" für maximale Geschwindigkeit.
    *   *Killer*: Zerstört aktiv Speicherbereiche vor der Replikation.
    *   *Fortress*: Baut Schutzwälle aus tödlichen Befehlen (`DIE`).
*   **Spawn-Funktion**: Fügen Sie jederzeit neue Spezies in die laufende Simulation ein, um "Turniere" zu veranstalten oder das Gleichgewicht zu stören.
*   **Ursuppe**: Starten Sie mit reinem Chaos und sehen Sie zu, ob Leben entsteht.
*   **Kontrolle**: Passen Sie Geschwindigkeit, Mutationsrate und Lebensdauer in Echtzeit an.
*   **Speichern/Laden**: Sichern Sie interessante Zustände und teilen Sie sie.

## 🎮 Bedienung

1.  Öffnen Sie `index.html` in Ihrem Browser.
2.  Wählen Sie eine Spezies aus dem Dropdown-Menü.
3.  Klicken Sie auf **Reset**, um mit dieser Spezies neu zu starten.
4.  Oder klicken Sie auf **Spawn**, um Exemplare der gewählten Spezies in die laufende Schlacht zu werfen.

### Steuerelemente

*   **Start/Pause**: Steuert den Simulationslauf.
*   **Schritt**: Einzelner Zyklus (für Debugging).
*   **Reset**: Löscht den Speicher und platziert die gewählte Spezies in die Mitte.
*   **Spawn**: Fügt die gewählte Spezies an einer zufälligen Position hinzu (ohne Reset).
*   **Ursuppe**: Füllt den Speicher mit Zufallsdaten.
*   **Geschwindigkeit**: Wie viele VM-Zyklen pro Frame berechnet werden.
*   **Mutation**: Wahrscheinlichkeit für Bit-Flips beim Schreiben.
*   **Max Alter**: Begrenzt die Lebensdauer von Prozessen (verhindert Stagnation durch "unsterbliche" Leichen).

## 🛠 Technische Details

Die Simulation ist in reinem JavaScript (`script.js`) geschrieben und nutzt HTML5 Canvas für die Darstellung.

### Befehlssatz (ISA)
Die VM nutzt eine RISC-ähnliche Architektur mit 32-Bit Befehlen:
*   `MOV`, `ADD`, `SUB`: Arithmetik und Datentransfer.
*   `JMP`, `JZ`, `JNZ`: Sprünge und Bedingungen.
*   `SEQ`, `SNE`: Vergleiche (Skip Equal/Not Equal).
*   `SPWN`: Erzeugt einen neuen Prozess an einer Zieladresse.
*   `DIE`: Beendet den aktuellen Prozess sofort.
*   `RAND`: Erzeugt Zufallszahlen (wichtig für Killer/Evolution).

### Adressierungsmodi
*   Immediate (#)
*   Relative ($)
*   Register (%)
*   Register Indirect (@)

## Entwicklung & Tests

Um Änderungen an der VM-Logik zu testen, können Sie die Node.js-Tests ausführen:

```bash
node test_vm.js
```
