// Bio-Programs Simulation

// --- Configuration ---
const MEMORY_SIZE = 4096;
const MAX_PROCESSES = 1000;
let mutationRate = 0.001;
const MAX_CYCLES = 1000000;

// --- Instruction Set Architecture (ISA) ---
const OPCODES = {
    NOP: 0,
    MOV: 1,
    ADD: 2,
    SUB: 3,
    JMP: 4,
    JZ:  5,
    JNZ: 6,
    SPWN: 7,
    SEQ: 8,
    SNE: 9,
    RAND: 10,
    DIE: 15
};

const MODES = {
    IMMEDIATE: 0,
    RELATIVE: 1,
    REGISTER: 2,
    REG_INDIRECT: 3
};

const FIELD_MASK = 0xFFF;

class Instruction {
    constructor(opcode, modeA, valA, modeB, valB) {
        this.opcode = opcode;
        this.modeA = modeA;
        this.valA = valA;
        this.modeB = modeB;
        this.valB = valB;
    }

    static encode(op, modeA, valA, modeB, valB) {
        let word = 0;
        word |= (op & 0xF) << 28;
        word |= (modeA & 0x3) << 26;
        word |= (valA & FIELD_MASK) << 14;
        word |= (modeB & 0x3) << 12;
        word |= (valB & FIELD_MASK);
        return word;
    }

    static decode(word) {
        const op = (word >>> 28) & 0xF;
        const modeA = (word >>> 26) & 0x3;
        let valA = (word >>> 14) & FIELD_MASK;
        const modeB = (word >>> 12) & 0x3;
        let valB = word & FIELD_MASK;

        if (valA & 0x800) valA |= 0xFFFFF000;
        if (valB & 0x800) valB |= 0xFFFFF000;

        return new Instruction(op, modeA, valA, modeB, valB);
    }

    static disassemble(instr) {
        const opNames = Object.keys(OPCODES).find(key => OPCODES[key] === instr.opcode) || "UNK";

        function fmt(mode, val) {
            switch (mode) {
                case MODES.IMMEDIATE: return `#${val}`;
                case MODES.RELATIVE: return `$${val}`;
                case MODES.REGISTER: return `%${val}`;
                case MODES.REG_INDIRECT: return `@%${val}`;
                default: return `?${val}`;
            }
        }

        return `${opNames} ${fmt(instr.modeA, instr.valA)}, ${fmt(instr.modeB, instr.valB)}`;
    }
}

// --- VM Classes ---

class Process {
    constructor(ip, parent = null, hue = null) {
        this.ip = ip;
        this.registers = new Int32Array(4).fill(0);
        this.alive = true;
        this.age = 0;
        this.gen = parent ? parent.gen + 1 : 0;

        if (hue !== null) {
            this.hue = hue;
        } else if (parent) {
             this.hue = parent.hue + (Math.random() * 20 - 10); // +/- 10 deg variation
             if (this.hue < 0) this.hue += 360;
             if (this.hue > 360) this.hue -= 360;
        } else {
             this.hue = Math.random() * 360;
        }
        this.color = `hsl(${Math.floor(this.hue)}, 100%, 50%)`;
    }
}

class VM {
    constructor() {
        this.memory = new Int32Array(MEMORY_SIZE).fill(0);
        this.memoryMap = new Array(MEMORY_SIZE).fill(null);
        this.processes = [];
        this.cycles = 0;
        this.totalMutations = 0;
        this.populationHistory = [];
        this.maxAge = 0; // 0 = Infinite
    }

    reset() {
        this.memory.fill(0);
        this.memoryMap.fill(null);
        this.processes = [];
        this.cycles = 0;
        this.totalMutations = 0;
        this.populationHistory = [];
    }

    exportState() {
        return JSON.stringify({
            memory: Array.from(this.memory),
            memoryMap: this.memoryMap,
            processes: this.processes.map(p => ({
                ip: p.ip,
                registers: Array.from(p.registers),
                alive: p.alive,
                age: p.age,
                gen: p.gen,
                hue: p.hue,
                color: p.color
            })),
            cycles: this.cycles,
            totalMutations: this.totalMutations,
            maxAge: this.maxAge,
            populationHistory: this.populationHistory
        });
    }

    importState(json) {
        const state = JSON.parse(json);
        this.memory = new Int32Array(state.memory);
        this.memoryMap = state.memoryMap;
        this.processes = state.processes.map(pData => {
            const p = new Process(pData.ip);
            p.registers = new Int32Array(pData.registers);
            p.alive = pData.alive;
            p.age = pData.age;
            p.gen = pData.gen;
            p.hue = pData.hue;
            p.color = pData.color;
            return p;
        });
        this.cycles = state.cycles || 0;
        this.totalMutations = state.totalMutations || 0;
        this.maxAge = state.maxAge || 0;
        this.populationHistory = state.populationHistory || [];
    }

    addProcess(ip, parent = null, hue = null) {
        if (this.processes.length < MAX_PROCESSES) {
            const p = new Process(ip % MEMORY_SIZE, parent, hue);
            this.processes.push(p);
            return p;
        }
        return null;
    }

    wrap(addr) {
        return ((addr % MEMORY_SIZE) + MEMORY_SIZE) % MEMORY_SIZE;
    }

    getVal(p, mode, val) {
        switch (mode) {
            case MODES.IMMEDIATE: return val;
            case MODES.RELATIVE: return this.memory[this.wrap(p.ip + val)];
            case MODES.REGISTER: return p.registers[Math.abs(val) % 4];
            case MODES.REG_INDIRECT: return this.memory[this.wrap(p.registers[Math.abs(val) % 4])];
            default: return 0;
        }
    }

    getAddr(p, mode, val) {
        switch (mode) {
            case MODES.IMMEDIATE: return -1;
            case MODES.RELATIVE: return this.wrap(p.ip + val);
            case MODES.REGISTER: return -2;
            case MODES.REG_INDIRECT: return this.wrap(p.registers[Math.abs(val) % 4]);
            default: return -1;
        }
    }

    writeMem(addr, value, ownerProcess) {
        const target = this.wrap(addr);

        let finalValue = value;
        if (Math.random() < mutationRate) {
             const bit = Math.floor(Math.random() * 32);
             finalValue ^= (1 << bit);
             this.totalMutations++;
        }

        this.memory[target] = finalValue;
        this.memoryMap[target] = ownerProcess.color;
    }

    step() {
        this.processes = this.processes.filter(p => p.alive);

        if (this.processes.length === 0) return;

        for (let i = 0; i < this.processes.length; i++) {
            const p = this.processes[i];

            const instrWord = this.memory[p.ip];
            const instr = Instruction.decode(instrWord);

            let newIP = p.ip + 1;

            try {
                switch (instr.opcode) {
                    case OPCODES.NOP:
                        break;
                    case OPCODES.MOV: {
                        const valA = this.getVal(p, instr.modeA, instr.valA);
                        if (instr.modeB === MODES.REGISTER) {
                             p.registers[Math.abs(instr.valB) % 4] = valA;
                        } else {
                            const addrB = this.getAddr(p, instr.modeB, instr.valB);
                            if (addrB >= 0) {
                                this.writeMem(addrB, valA, p);
                            }
                        }
                        break;
                    }
                    case OPCODES.ADD: {
                        const valA = this.getVal(p, instr.modeA, instr.valA);
                        if (instr.modeB === MODES.REGISTER) {
                            p.registers[Math.abs(instr.valB) % 4] += valA;
                        } else {
                            const addrB = this.getAddr(p, instr.modeB, instr.valB);
                            if (addrB >= 0) {
                                const current = this.memory[addrB];
                                this.writeMem(addrB, current + valA, p);
                            }
                        }
                        break;
                    }
                    case OPCODES.SUB: {
                         const valA = this.getVal(p, instr.modeA, instr.valA);
                        if (instr.modeB === MODES.REGISTER) {
                            p.registers[Math.abs(instr.valB) % 4] -= valA;
                        } else {
                            const addrB = this.getAddr(p, instr.modeB, instr.valB);
                            if (addrB >= 0) {
                                const current = this.memory[addrB];
                                this.writeMem(addrB, current - valA, p);
                            }
                        }
                        break;
                    }
                    case OPCODES.JMP: {
                        const target = this.getAddr(p, instr.modeA, instr.valA);
                        if (target >= 0) {
                            newIP = target;
                        }
                        break;
                    }
                    case OPCODES.JZ: {
                        const valB = this.getVal(p, instr.modeB, instr.valB);
                        if (valB === 0) {
                            const target = this.getAddr(p, instr.modeA, instr.valA);
                             if (target >= 0) {
                                newIP = target;
                            }
                        }
                        break;
                    }
                    case OPCODES.JNZ: {
                        const valB = this.getVal(p, instr.modeB, instr.valB);
                        if (valB !== 0) {
                            const target = this.getAddr(p, instr.modeA, instr.valA);
                             if (target >= 0) {
                                newIP = target;
                            }
                        }
                        break;
                    }
                    case OPCODES.SPWN: {
                         const target = this.getAddr(p, instr.modeA, instr.valA);
                         if (target >= 0) {
                             if (this.processes.length < MAX_PROCESSES) {
                                 const newP = new Process(target, p);
                                 this.processes.push(newP);
                             }
                         }
                         break;
                    }
                    case OPCODES.SEQ: {
                        const valA = this.getVal(p, instr.modeA, instr.valA);
                        const valB = this.getVal(p, instr.modeB, instr.valB);
                        if (valA === valB) {
                            newIP++; // Skip next
                        }
                        break;
                    }
                    case OPCODES.SNE: {
                        const valA = this.getVal(p, instr.modeA, instr.valA);
                        const valB = this.getVal(p, instr.modeB, instr.valB);
                        if (valA !== valB) {
                            newIP++; // Skip next
                        }
                        break;
                    }
                    case OPCODES.RAND: {
                        const val = Math.floor(Math.random() * MEMORY_SIZE);
                        if (instr.modeB === MODES.REGISTER) {
                            p.registers[Math.abs(instr.valB) % 4] = val;
                        } else {
                            const addrB = this.getAddr(p, instr.modeB, instr.valB);
                            if (addrB >= 0) {
                                this.writeMem(addrB, val, p);
                            }
                        }
                        break;
                    }
                    case OPCODES.DIE:
                        p.alive = false;
                        break;
                }
            } catch (e) {
                console.error("Exec error", e);
                p.alive = false;
            }

            p.ip = this.wrap(newIP);
            p.age++;
            if (this.maxAge > 0 && p.age > this.maxAge) {
                p.alive = false;
            }
        }

        this.cycles++;
    }
}

// --- Species Generation ---

const SPECIES_COLORS = {
    "Basic": 200, // Blue
    "SmartLoop": 120, // Green
    "Hyper": 60, // Yellow
    "Killer": 0, // Red
    "Fortress": 300, // Magenta
    "Teleporter": 270, // Purple
    "Glider": 180 // Cyan
};

function getSpeciesProgram(name) {
    const offset = 128; // Standard distance for children
    const program = [];

    // Header logic
    let header = [];
    if (name === "Killer") {
        // Shoots random zeros into memory before replicating
        for(let k=0; k<5; k++) {
            header.push(Instruction.encode(OPCODES.RAND, 0, 0, MODES.REGISTER, 0));
            header.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 15, MODES.REG_INDIRECT, 0));
        }
    }

    if (name === "Fortress") {
        // Fortress: Writes DIE instructions around itself before replicating
        // Writes DIE (Opcode 15) to -1 (Behind) and +30 (Ahead)
        header.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 15, MODES.RELATIVE, -1));
        header.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 15, MODES.RELATIVE, 30));
    }

    if (name === "Teleporter") {
        // Teleporter (Chaos):
        // Picks a random address, copies itself there using REG_INDIRECT, and Spawns.
        // Avoids local crowding by jumping to random locations.
        // Strategy:
        // 0: RAND %0 (Dest)
        // 1: MOV #Size, %1 (Limit)
        // 2: MOV #0, %2 (Counter)
        // 3: MOV $Template, %3 (Load Template: MOV REL(Src), @%0)
        // 4: MOV %3, $Exec (Write to Exec slot)
        // 5: Exec (Placeholder)
        // 6: ADD #1, %0 (Inc Dest Addr)
        // 7: ADD $Const, %3 (Inc Src Offset in Template)
        // 8: ADD #1, %2 (Inc Counter)
        // 9: SEQ %2, %1 (Check Limit)
        // 10: JMP Loop (Back to 4)
        // 11: SUB %1, %0 (Restore Start Addr)
        // 12: SPWN @%0
        // 13: DIE
        // 14: [Template Data]
        // 15: [Constant Data]

        const totalSize = 16;
        const execIndex = 5;
        const loopStartIndex = 4;

        // Template: MOV REL(Start - Exec), @%0
        // Start is Index 0. Exec is Index 5.
        // SrcRel = -5.
        // DstMode = REG_INDIRECT (3), DstVal = 0 (Register 0).
        const template = Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -5, MODES.REG_INDIRECT, 0);

        // Constant: Add 1 to Src (High 12 bits of valA).
        // valA is bits 14..25. 1<<14.
        const constant = 1 << 14;

        // 0: RAND %0
        program.push(Instruction.encode(OPCODES.RAND, 0, 0, MODES.REGISTER, 0));
        // 1: MOV #Size, %1
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, totalSize, MODES.REGISTER, 1));
        // 2: MOV #0, %2
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 0, MODES.REGISTER, 2));
        // 3: MOV $Template, %3. Template at 14. 14-3=11.
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, 11, MODES.REGISTER, 3));

        // Loop Start (4)
        // 4: MOV %3, $Exec. Exec at 5. 5-4=1.
        program.push(Instruction.encode(OPCODES.MOV, MODES.REGISTER, 3, MODES.RELATIVE, 1));
        // 5: Exec (NOP)
        program.push(0);
        // 6: ADD #1, %0
        program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 0));
        // 7: ADD $Const, %3. Const at 15. 15-7=8.
        program.push(Instruction.encode(OPCODES.ADD, MODES.RELATIVE, 8, MODES.REGISTER, 3));
        // 8: ADD #1, %2
        program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 2));
        // 9: SEQ %2, %1
        program.push(Instruction.encode(OPCODES.SEQ, MODES.REGISTER, 2, MODES.REGISTER, 1));
        // 10: JMP Loop (4). 4-10 = -6.
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, -6, 0, 0));

        // 11: SUB %1, %0
        program.push(Instruction.encode(OPCODES.SUB, MODES.REGISTER, 1, MODES.REGISTER, 0));
        // 12: SPWN @%0
        program.push(Instruction.encode(OPCODES.SPWN, MODES.REG_INDIRECT, 0, 0, 0));
        // 13: DIE
        program.push(Instruction.encode(OPCODES.DIE, 0, 0, 0, 0));

        // 14: Template
        program.push(template);
        // 15: Constant
        program.push(constant);

        return program;
    }

    if (name === "Glider") {
        // Glider: Moves itself by replicating to offset, spawning child, then killing parent.
        // It uses the same compact loop as SmartLoop, but adds a suicide pill.
        // Since SmartLoop is complex to modify inline, we build a custom Glider.
        // Structure:
        // [Template] (0)
        // [Constant] (1)
        // [Boot] (2..5)
        // [Loop] (6..12)
        // [Spawn] (13)
        // [Suicide] (14)

        const totalSize = 15;
        // Offsets:
        // Template: 0
        // Constant: 1
        // Boot: 2..5
        // Loop: 6..12
        // Spawn: 13
        // DIE: 14

        // Worker is at Loop+3 = 9.
        const workerIndex = 9;
        const srcRel = -workerIndex;
        const dstRel = offset - workerIndex;

        const templateInstr = Instruction.encode(OPCODES.MOV, MODES.RELATIVE, srcRel, MODES.RELATIVE, dstRel);
        const constantVal = 16385; // 1<<14 | 1

        // 0: Template
        program.push(templateInstr);
        // 1: Constant
        program.push(constantVal);

        // Boot
        // 2: MOV #0, %0 (i)
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 0, MODES.REGISTER, 0));
        // 3: MOV #Size, %1 (Limit)
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, totalSize, MODES.REGISTER, 1));
        // 4: MOV $Template, %2 (Load Template from 0. IP=4. 0-4=-4)
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -4, MODES.REGISTER, 2));
        // 5: MOV $Constant, %3 (Load Constant from 1. IP=5. 1-5=-4)
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -4, MODES.REGISTER, 3));

        // Loop
        // 6: SNE %0, %1 (Check done)
        program.push(Instruction.encode(OPCODES.SNE, MODES.REGISTER, 0, MODES.REGISTER, 1));
        // 7: JMP Spawn (Skip Loop Body. Target 13. 13-7=6)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, 6, 0, 0));

        // 8: MOV %2, $1 (Reset Worker at +1)
        program.push(Instruction.encode(OPCODES.MOV, MODES.REGISTER, 2, MODES.RELATIVE, 1));
        // 9: Worker (Placeholder)
        program.push(Instruction.encode(OPCODES.NOP, 0, 0, 0, 0));
        // 10: ADD %3, %2 (Inc Template)
        program.push(Instruction.encode(OPCODES.ADD, MODES.REGISTER, 3, MODES.REGISTER, 2));
        // 11: ADD #1, %0 (Inc Counter)
        program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 0));
        // 12: JMP Back (Target 6. 6-12=-6)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, -6, 0, 0));

        // 13: SPWN
        // Target = Start + Offset.
        // Current IP = Start + 13.
        // Rel = (Start + Offset) - (Start + 13) = Offset - 13.
        program.push(Instruction.encode(OPCODES.SPWN, MODES.RELATIVE, offset - 13, 0, 0));

        // 14: DIE
        program.push(Instruction.encode(OPCODES.DIE, 0, 0, 0, 0));

        return program;
    }

    if (name === "Hyper") {
        // Hyper Replicator v5: Fixed Split-Loop with Workers at End.
        // Fixes "Packed ADD Carry" bug by ensuring negative offsets never wrap to 0.
        // Uses single-step copying to avoid skipping odd words, and manually copies JMPs in Setup.
        // Layout:
        // 0..3: Boot (4)
        // 4..10: Loop1 (7)
        // 11..15: Setup2 (5)
        // 16..22: Loop2 (7)
        // 23..26: Data (4)
        // 27..28: Worker A (2)
        // 29..30: Worker B (2)
        // 31..32: Spawn (2)
        // Total: 33 words

        const totalSize = 33;
        const limit1 = 27; // Copy 0..26 (Pre-WA)
        const start2 = 31; // Copy 31..32 (Spawn)

        // Indices
        const loop1Index = 4;
        const setup2Index = 11;
        const loop2Index = 16;
        const dataIndex = 23;
        const waIndex = 27;
        const wbIndex = 29;
        const spawnIndex = 31;

        const tmpl1Index = 23;
        const tmpl2Index = 24;
        const constIndex = 25;
        const lim1Index = 26;

        // Loop 1 Tmpl: Src -27, Dst Offset-27.
        // Copies index 0 relative to WA(27).
        const srcRel1 = -27;
        const dstRel1 = offset - 27;
        const tmpl1 = Instruction.encode(OPCODES.MOV, MODES.RELATIVE, srcRel1, MODES.RELATIVE, dstRel1);

        // Loop 2 Tmpl: Src 31-29 = 2. Dst Offset+2.
        // Copies index 31 relative to WB(29).
        const srcRel2 = 31 - 29;
        const dstRel2 = offset + (31 - 29);
        const tmpl2 = Instruction.encode(OPCODES.MOV, MODES.RELATIVE, srcRel2, MODES.RELATIVE, dstRel2);

        const constVal = (1 << 14) | 1; // Add 1, 1

        // 0..3 Boot
        // 0: MOV #0, %0
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 0, MODES.REGISTER, 0));
        // 1: MOV #Limit1, %1. Target 26. 26-1 = 25.
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, lim1Index - 1, MODES.REGISTER, 1));
        // 2: MOV Tmpl1, %2. Target 23. 23-2 = 21.
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, tmpl1Index - 2, MODES.REGISTER, 2));
        // 3: MOV Const, %3. Target 25. 25-3 = 22.
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, constIndex - 3, MODES.REGISTER, 3));

        // 4..10 Loop1
        // 4: SNE %0, %1 (Check Limit)
        program.push(Instruction.encode(OPCODES.SNE, MODES.REGISTER, 0, MODES.REGISTER, 1));
        // 5: JMP Setup2 (Target 11. 11-5 = 6)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, setup2Index - 5, 0, 0));
        // 6: MOV %2, WA (Reset Worker. WA at 27. 27-6=21)
        program.push(Instruction.encode(OPCODES.MOV, MODES.REGISTER, 2, MODES.RELATIVE, waIndex - 6));
        // 7: JMP WA (Target 27. 27-7=20)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, waIndex - 7, 0, 0));
        // 8: ADD %3, %2 (Back1 Target). Inc Tmpl.
        program.push(Instruction.encode(OPCODES.ADD, MODES.REGISTER, 3, MODES.REGISTER, 2));
        // 9: ADD #1, %0. Inc Counter.
        program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 0));
        // 10: JMP Loop1 (Target 4. 4-10=-6)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, -6, 0, 0));

        // 11..15 Setup2
        // 11: MOV Tmpl2, %2. Target 24. 24-11=13.
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, tmpl2Index - 11, MODES.REGISTER, 2));
        // 12: MOV #Start2, %0. (31)
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, start2, MODES.REGISTER, 0));
        // 13: MOV #Total, %1. (33)
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, totalSize, MODES.REGISTER, 1));
        // 14: MOV Rel(WA_JMP), Rel(Child+WA_JMP).
        // WA_JMP is at 28. Offset relative to 14 is 14.
        // Child+28 relative to Child+14 is 14. Rel(Offset+14).
        // Using REL mode for Dest means relative to IP (Child IP + 14).
        // But we want to WRITE to Child memory.
        // If we use MOV REL, REL.
        // Dest is RELATIVE to IP.
        // IP is 14. Target is 14 + (Offset + 14) = 28 + Offset.
        // This is Child+28. Correct.
        // Src is RELATIVE to IP.
        // IP is 14. Target is 14 + 14 = 28.
        // This is Self+28. Correct.
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, 14, MODES.RELATIVE, offset + 14));
        // 15: MOV Rel(WB_JMP), Rel(Child+WB_JMP).
        // WB_JMP is at 30. Relative to 15 is 15.
        // Dest: Offset + 15.
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, 15, MODES.RELATIVE, offset + 15));

        // 16..22 Loop2
        // 16: SNE %0, %1
        program.push(Instruction.encode(OPCODES.SNE, MODES.REGISTER, 0, MODES.REGISTER, 1));
        // 17: JMP Spawn (Target 31. 31-17=14)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, spawnIndex - 17, 0, 0));
        // 18: MOV %2, WB (WB at 29. 29-18=11)
        program.push(Instruction.encode(OPCODES.MOV, MODES.REGISTER, 2, MODES.RELATIVE, wbIndex - 18));
        // 19: JMP WB (Target 29. 29-19=10)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, wbIndex - 19, 0, 0));
        // 20: ADD %3, %2 (Back2 Target). Inc Tmpl.
        program.push(Instruction.encode(OPCODES.ADD, MODES.REGISTER, 3, MODES.REGISTER, 2));
        // 21: ADD #1, %0. Inc Counter.
        program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 0));
        // 22: JMP Loop2 (Target 16. 16-22=-6)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, -6, 0, 0));

        // 23..26 Data
        program.push(tmpl1);
        program.push(tmpl2);
        program.push(constVal);
        program.push(limit1);

        // 27..28 WorkerA
        // 27: NOP
        program.push(0);
        // 28: JMP Back1 (Target 8. 8-28=-20)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, 8 - 28, 0, 0));

        // 29..30 WorkerB
        // 29: NOP
        program.push(0);
        // 30: JMP Back2 (Target 20. 20-30=-10)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, 20 - 30, 0, 0));

        // 31..32 Spawn
        program.push(Instruction.encode(OPCODES.SPWN, MODES.RELATIVE, offset - 31, 0, 0));
        program.push(Instruction.encode(OPCODES.DIE, 0, 0, 0, 0));

        return program;
    }

    if (name === "Basic") {
        // Basic Replicator: Separated ADDs, requires Constant for High Bits.
        // Structure:
        // [Template] (Data, Index 0)
        // [Constant] (Data, Index 1, Value 1<<14)
        // [Boot] (Init Regs, Index 2..5)
        // [Loop] (Index 6..12)
        // [Spawn] (Index 13..14)

        const totalSize = 15;

        // Loop is at Index 6. Worker is at Index 6+1 = 7.
        // Template is at Index 0.
        // SrcRel = 0 - 7 = -7.
        // DstRel = Offset - 7.
        const workerIndex = 7;
        const srcRel = -workerIndex;
        const dstRel = offset - workerIndex;

        // 0: Template
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, srcRel, MODES.RELATIVE, dstRel));
        // 1: Constant (1<<14)
        program.push(1<<14);

        // 2: MOV #0, %0 (Counter)
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 0, MODES.REGISTER, 0));
        // 3: MOV #Size, %1 (Limit)
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, totalSize, MODES.REGISTER, 1));
        // 4: MOV $Template, %2 (Load Template from Index 0. IP=4. 0-4 = -4)
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -4, MODES.REGISTER, 2));
        // 5: MOV $Constant, %3 (Load Constant from Index 1. IP=5. 1-5 = -4)
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -4, MODES.REGISTER, 3));

        // Loop Start (Index 6)
        // 6: MOV %2, $Worker (Reset Worker at Index 7. Rel=1)
        program.push(Instruction.encode(OPCODES.MOV, MODES.REGISTER, 2, MODES.RELATIVE, 1));
        // 7: Worker (Placeholder)
        program.push(Instruction.encode(OPCODES.NOP, 0, 0, 0, 0));
        // 8: ADD #1, %2 (Inc Dst/ValB)
        program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 2));
        // 9: ADD %3, %2 (Inc Src/ValA using Register 3)
        program.push(Instruction.encode(OPCODES.ADD, MODES.REGISTER, 3, MODES.REGISTER, 2));
        // 10: ADD #1, %0 (Inc Counter)
        program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 0));
        // 11: SEQ %0, %1 (If Counter == Limit, Skip Jump)
        program.push(Instruction.encode(OPCODES.SEQ, MODES.REGISTER, 0, MODES.REGISTER, 1));
        // 12: JMP Start (Jump to 6. IP=12. Target=6. Offset = -6)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, -6, 0, 0));

        // Spawn
        // 13: SPWN Rel(Offset - Size + ...)
        // Target = Start + Offset.
        // Current IP = Start + 13.
        // Rel = (Start + Offset) - (Start + 13) = Offset - 13.
        program.push(Instruction.encode(OPCODES.SPWN, MODES.RELATIVE, offset - 13, 0, 0));
        // 14: DIE
        program.push(Instruction.encode(OPCODES.DIE, 0, 0, 0, 0));

        return program;
    }

    // Default: SmartLoop (used for SmartLoop and Killer base)
    // Structure:
    // [Header]
    // [Template Data] (Never executed, Index 0)
    // [Constant Data] (16385, Index 1)
    // [Boot] (Init registers, Index 2, 3, 4, 5)
    // [Loop] (Copy -> Increment -> Check -> Loop)
    // [Spawn]

    // Offsets
    const headerSize = header.length;
    const templateSize = 1;
    const constantSize = 1; // New
    const bootSize = 4; // Was 3. Now 4 instructions (Init i, Limit, Template, Constant)
    const loopBodySize = 7;
    const spawnSize = 2; // SPWN, DIE

    const totalSize = headerSize + templateSize + constantSize + bootSize + loopBodySize + spawnSize;

    // indices relative to start of SmartLoop part
    // Template: 0
    // Constant: 1
    // Boot: 2..5
    // Loop: 6..12

    // Worker Index Calculation:
    // Loop starts at 6.
    // Loop body: SNE, JMP, MOV(Reset), WORKER, ADD, ADD, JMP.
    // Worker is at index 3 of Loop Body.
    // So Global Worker Index = 6 + 3 = 9.

    // Template Instruction: MOV $(Src), $(Dst)
    // SrcRel = 0 - WorkerIndex = -WorkerIndex.
    // DstRel = Offset - WorkerIndex.

    const workerIndex = headerSize + 9;
    const srcRel = -workerIndex;
    const dstRel = offset - workerIndex;

    const templateInstr = Instruction.encode(OPCODES.MOV, MODES.RELATIVE, srcRel, MODES.RELATIVE, dstRel);
    const constantVal = 16385; // 1<<14 | 1

    // Add Header
    program.push(...header);

    // Add Template (Data)
    program.push(templateInstr);

    // Add Constant (Data)
    program.push(constantVal);

    // Boot
    // 0: MOV #0, %0 (i)
    program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 0, MODES.REGISTER, 0));
    // 1: MOV #Size, %1 (Limit)
    program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, totalSize, MODES.REGISTER, 1));
    // 2: MOV $Template, %2 (Load Template from Index 0)
    // Boot starts at Index 2 relative to SmartLoop.
    // Current IP (for this instr) is Index 4 (2+2).
    // Template is at Index 0.
    // Rel Offset = 0 - 4 = -4.
    program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -4, MODES.REGISTER, 2));
    // 3: MOV $Constant, %3 (Load Constant from Index 1)
    // Current IP is Index 5.
    // Constant is at Index 1.
    // Rel Offset = 1 - 5 = -4.
    program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -4, MODES.REGISTER, 3));

    // Loop
    // 0: SNE %0, %1 (Check done: if i != limit, skip jump to spawn)
    program.push(Instruction.encode(OPCODES.SNE, MODES.REGISTER, 0, MODES.REGISTER, 1));
    // 1: JMP Spawn (Skip 5 instructions: MOV, WORK, ADD, ADD, JMP) -> Jump +6
    program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, 6, 0, 0));

    // 2: MOV %2, $1 (Reset Worker. Worker is at +1)
    program.push(Instruction.encode(OPCODES.MOV, MODES.REGISTER, 2, MODES.RELATIVE, 1));

    // 3: Worker (Placeholder)
    program.push(Instruction.encode(OPCODES.NOP, 0, 0, 0, 0));

    // 4: ADD %3, %2 (Inc Template Reg using Constant in %3)
    program.push(Instruction.encode(OPCODES.ADD, MODES.REGISTER, 3, MODES.REGISTER, 2));

    // 5: ADD #1, %0 (Inc Counter)
    program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 0));

    // 6: JMP -6 (Back to SNE)
    program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, -6, 0, 0));

    // Spawn
    // SPWN (Offset). Relative to *this* instruction.
    // We want to spawn at `Start + Offset`.
    // This instruction index = TotalSize - 2.
    // Relative = `(Start + Offset) - (Start + TotalSize - 2)` = `Offset - TotalSize + 2`.
    program.push(Instruction.encode(OPCODES.SPWN, MODES.RELATIVE, offset - totalSize + 2, 0, 0));
    program.push(Instruction.encode(OPCODES.DIE, 0, 0, 0, 0));

    return program;
}

// --- Visualization & UI ---

let vm;
let animationId;
let isRunning = false;
let speed = 50;

function placeSpecies(speciesName, startAddr) {
    const program = getSpeciesProgram(speciesName);
    const hue = SPECIES_COLORS[speciesName] !== undefined ? SPECIES_COLORS[speciesName] : Math.random() * 360;

    // Clear area (safety margin)
    for(let i=0; i<program.length + 20; i++) {
        const addr = (startAddr + i) % MEMORY_SIZE;
        vm.memory[addr] = 0;
        vm.memoryMap[addr] = null;
    }

    // Write program
    for(let i=0; i<program.length; i++) {
        const addr = (startAddr + i) % MEMORY_SIZE;
        vm.memory[addr] = program[i];
        vm.memoryMap[addr] = 'white';
    }

    vm.addProcess(startAddr, null, hue);
}

function spawnSpecies(speciesName) {
    if (!vm) return;
    const program = getSpeciesProgram(speciesName);
    // Find random address
    const startAddr = Math.floor(Math.random() * (MEMORY_SIZE - program.length));
    placeSpecies(speciesName, startAddr);
    draw();
    updateStats();
}

function init(speciesName = "Basic") {
    vm = new VM();
    // Start in the middle
    const startAddr = Math.floor(MEMORY_SIZE / 2);
    placeSpecies(speciesName, startAddr);

    draw();
    updateStats();
    drawPopulationGraph();
}

function initRandomSoup() {
    vm = new VM();

    // Fill memory with random instructions
    for(let i=0; i<MEMORY_SIZE; i++) {
        // Random 32-bit integer
        vm.memory[i] = Math.floor(Math.random() * 0xFFFFFFFF);
    }

    // Create random processes
    for(let i=0; i<50; i++) {
        const ip = Math.floor(Math.random() * MEMORY_SIZE);
        vm.addProcess(ip);
    }

    draw();
    updateStats();
    drawPopulationGraph();
}

function initTournament() {
    vm = new VM();

    // Corners
    const step = MEMORY_SIZE / 4;
    placeSpecies("Basic", 0);
    placeSpecies("SmartLoop", step);
    placeSpecies("Killer", step * 2);
    placeSpecies("Teleporter", step * 3);

    draw();
    updateStats();
    drawPopulationGraph();
}

function loop() {
    if (!isRunning) return;

    // Run 'speed' cycles per frame
    for(let k=0; k<speed; k++) {
        vm.step();
    }

    draw();
    updateStats();
    drawPopulationGraph();
    animationId = requestAnimationFrame(loop);
}

function drawPopulationGraph() {
    const canvas = document.getElementById('populationGraph');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Update history
    vm.populationHistory.push(vm.processes.length);
    if (vm.populationHistory.length > width) {
        vm.populationHistory.shift();
    }

    // Draw
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;

    const maxPop = Math.max(MAX_PROCESSES, ...vm.populationHistory);

    for (let i = 0; i < vm.populationHistory.length; i++) {
        const x = i;
        const pop = vm.populationHistory[i];
        const y = height - (pop / maxPop * height);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw current value text
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`Pop: ${vm.processes.length}`, width - 60, 20);
}

function draw() {
    const canvas = document.getElementById('memoryCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 4096 cells.
    // Grid size: 64x64.
    const cols = 64;
    const rows = 64;
    const cellW = width / cols;
    const cellH = height / rows;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < MEMORY_SIZE; i++) {
        const x = (i % cols) * cellW;
        const y = Math.floor(i / cols) * cellH;

        if (vm.memoryMap[i]) {
            ctx.fillStyle = vm.memoryMap[i];
            ctx.fillRect(x, y, cellW, cellH);
        } else if (vm.memory[i] !== 0) {
            ctx.fillStyle = '#333'; // Dead data
            ctx.fillRect(x, y, cellW, cellH);
        }
    }

    // Draw IPs
    for (let p of vm.processes) {
        const i = p.ip;
        const x = (i % cols) * cellW;
        const y = Math.floor(i / cols) * cellH;

        ctx.fillStyle = '#fff';
        ctx.fillRect(x+1, y+1, cellW-2, cellH-2);
    }
}

function updateStats() {
    const stats = document.getElementById('stats');
    if(stats) {
        let maxGen = 0;
        for (const p of vm.processes) {
            if (p.gen > maxGen) maxGen = p.gen;
        }
        stats.innerText = `Prozesse: ${vm.processes.length} | Zyklen: ${vm.cycles} | Max Gen: ${maxGen} | Mutationen: ${vm.totalMutations}`;
    }
}

// UI Handlers
if (typeof document !== 'undefined') {
    document.getElementById('startBtn').addEventListener('click', () => {
        if (!isRunning) {
            isRunning = true;
            loop();
        }
    });

    document.getElementById('pauseBtn').addEventListener('click', () => {
        isRunning = false;
        cancelAnimationFrame(animationId);
    });

    document.getElementById('stepBtn').addEventListener('click', () => {
        if (!isRunning && vm) {
            vm.step();
            draw();
            updateStats();
            drawPopulationGraph();
        }
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        isRunning = false;
        cancelAnimationFrame(animationId);
        const species = document.getElementById('speciesSelect').value;
        init(species);
    });

    document.getElementById('randomSoupBtn').addEventListener('click', () => {
        isRunning = false;
        cancelAnimationFrame(animationId);
        initRandomSoup();
    });

    document.getElementById('tournamentBtn').addEventListener('click', () => {
        isRunning = false;
        cancelAnimationFrame(animationId);
        initTournament();
    });

    document.getElementById('meteorBtn').addEventListener('click', () => {
        if (!vm) return;
        // Kill 50% of processes
        vm.processes.forEach(p => {
            if (Math.random() < 0.5) {
                p.alive = false;
            }
        });
        // Optional: Add visual noise or craters?
        // Let's clear some memory randomly too
        for(let i=0; i<100; i++) {
            const addr = Math.floor(Math.random() * MEMORY_SIZE);
            vm.memory[addr] = 0;
            vm.memoryMap[addr] = null;
        }
        draw();
        updateStats();
        drawPopulationGraph();
    });

    document.getElementById('spawnBtn').addEventListener('click', () => {
        const species = document.getElementById('speciesSelect').value;
        spawnSpecies(species);
    });

    document.getElementById('speedRange').addEventListener('input', (e) => {
        speed = parseInt(e.target.value);
    });

    document.getElementById('mutationRange').addEventListener('input', (e) => {
        // Range 0-100 maps to 0.0 - 0.1 (0% to 10%)
        const val = parseInt(e.target.value);
        mutationRate = val / 1000;
        document.getElementById('mutationValue').innerText = (mutationRate * 100).toFixed(1) + "%";
    });

    document.getElementById('maxAgeRange').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (vm) vm.maxAge = val;
        document.getElementById('maxAgeValue').innerText = val === 0 ? "∞" : val;
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        if (!vm) return;
        const json = vm.exportState();
        const blob = new Blob([json], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "bio-programs-state.json";
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const json = e.target.result;
            try {
                // Pause before loading
                isRunning = false;
                cancelAnimationFrame(animationId);

                vm.importState(json);

                // Update UI to reflect loaded state
                document.getElementById('maxAgeRange').value = vm.maxAge;
                document.getElementById('maxAgeValue').innerText = vm.maxAge === 0 ? "∞" : vm.maxAge;

                draw();
                updateStats();
                drawPopulationGraph();
                alert("Status geladen!");
            } catch (err) {
                console.error(err);
                alert("Fehler beim Laden: " + err.message);
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('memoryCanvas').addEventListener('click', (e) => {
        const canvas = e.target;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const cols = 64;
        const rows = 64;
        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;

        const col = Math.floor(x / cellW);
        const row = Math.floor(y / cellH);
        const idx = row * cols + col;

        if (idx >= 0 && idx < MEMORY_SIZE) {
            const word = vm.memory[idx];
            const instr = Instruction.decode(word);

            const asm = Instruction.disassemble(instr);

            // Find process at this IP
            const process = vm.processes.find(p => p.ip === idx);
            let processInfo = "";
            if (process) {
                processInfo = `<p><strong>Process Head</strong></p><p>Gen: ${process.gen}</p><p>Age: ${process.age}</p>`;
            }

            const info = document.getElementById('info');
            info.innerHTML = `
                <p>Addr: ${idx}</p>
                <p><strong>${asm}</strong></p>
                <p>Raw: 0x${word.toString(16).toUpperCase().padStart(8, '0')}</p>
                <p>Owner Color: <span style="display:inline-block;width:10px;height:10px;background-color:${vm.memoryMap[idx] || 'black'}"></span></p>
                ${processInfo}
            `;
        }
    });

    // Start
    init("Basic");
}

// Export for node testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MEMORY_SIZE, OPCODES, MODES, Instruction, VM, Process, getSpeciesProgram };
}
