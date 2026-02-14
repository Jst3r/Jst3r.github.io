---
title: "Loop Vectorization"
description: "How modern compilers turn your innocent for-loops into parallel processing powerhouses"
date: "2026-01-18"
tags: ["Vectorization", "Optimization", "Compiler", "SIMD", "Performance"]
readTime: "12 min read"
---

Picture your CPU as a highly trained chef. You hand it a recipe that says "dice 1,000 onions, one at a time." The CPU dutifully obliges, picking up onion after onion, making precisely 1,000 individual cuts. Meanwhile, you're wondering why your code takes so long to run.

Now imagine the chef suddenly realizes they have a much bigger knife—one that can cut through *eight onions at once*. Same task, same result, but now it takes only 125 cuts instead of 1,000. Welcome to **loop vectorization**.

## The Problem: One Thing at a Time is Slow

Let's start with a simple scenario. You have two arrays of numbers, and you want to add them together:

```c
void add_arrays(int *a, int *b, int *c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}
```

This code is clean, readable, and painfully sequential. The CPU executes this loop by:
1. Loading `a[0]` and `b[0]` from memory
2. Adding them together
3. Storing the result in `c[0]`
4. Incrementing the counter `i`
5. Checking if `i < n`
6. Repeating for `a[1]`, `b[1]`, `c[1]`... and so on

If your arrays have 1,000 elements, that's 1,000 separate addition operations. Each one waits politely for the previous one to finish, like a very orderly queue at a British post office.

### What's Actually Happening

Let's break down the actual cost in CPU cycles for each iteration:

```
Per iteration cost:
- Load a[i] from memory:    ~3-4 cycles (if in L1 cache)
- Load b[i] from memory:    ~3-4 cycles
- Perform addition:         ~1 cycle
- Store result to c[i]:     ~1 cycle
- Increment counter:        ~1 cycle
- Compare and branch:       ~1-2 cycles
                            ──────────
Total:                      ~10-13 cycles per element
```

For 1,000 elements, that's roughly **10,000-13,000 cycles** just to add two arrays. And that's assuming everything stays in cache—if data isn't cached, a memory access can take 200+ cycles instead of 3-4.

The fundamental issue: your CPU is doing single-threaded work when it has hardware specifically designed to process multiple data elements simultaneously.

## The Solution: SIMD (Single Instruction, Multiple Data)

Modern CPUs have a secret weapon: massive registers that can hold multiple values at once. While your typical register might hold one 32-bit integer, SIMD registers are much larger:

- **128-bit registers (SSE)**: Can hold 4 integers at once (128 ÷ 32 = 4)
- **256-bit registers (AVX)**: Can hold 8 integers at once (256 ÷ 32 = 8)
- **512-bit registers (AVX-512)**: Can hold 16 integers at once (512 ÷ 32 = 16)

When the compiler detects that your loop can be vectorized, it transforms your code to use these wider registers. Instead of processing one element per iteration, it processes 4, 8, or even 16 elements in a single instruction.

### A Brief SIMD History

**SSE (Streaming SIMD Extensions)** - Introduced in 1999 with Pentium III
- 128-bit registers (XMM0-XMM7, later expanded to XMM0-XMM15)
- Primarily for floating-point operations
- Could process 4 floats at once

**SSE2** - Introduced in 2001
- Added integer operations to 128-bit registers
- Made SIMD practical for general-purpose code
- Universal baseline for x86-64 architecture

**AVX (Advanced Vector Extensions)** - Introduced in 2011
- 256-bit registers (YMM0-YMM15)
- Can process 8 floats or 8 integers at once
- Introduced 3-operand instruction format (more efficient)

**AVX2** - Introduced in 2013
- Enhanced integer operations for 256-bit registers
- Added gather operations for non-contiguous memory access

**AVX-512** - Introduced in 2017
- 512-bit registers (ZMM0-ZMM31)
- 32 registers instead of 16
- Mask registers for conditional operations
- Can process 16 floats or 16 integers at once

As of 2026, most desktop and server CPUs support at least AVX2, making 8-element vectorization common.

### The Assembly Difference

Let's see what actually changes at the assembly level.

**Without vectorization** (compiled with `-O1`), your assembly might look like:
```asm
.loop:
    mov    eax, DWORD [rsi + rcx*4]    ; Load a[i] into eax
    add    eax, DWORD [rdx + rcx*4]    ; Add b[i] to eax
    mov    DWORD [rdi + rcx*4], eax    ; Store result to c[i]
    inc    rcx                         ; i++
    cmp    rcx, r8                     ; Compare i with n
    jl     .loop                       ; If i < n, continue loop
```

Each iteration processes exactly **one element** (4 bytes, hence the `*4` scaling).

**With vectorization** (compiled with `-O3 -march=haswell` for AVX2), it transforms into:
```asm
.vector_loop:
    vmovdqu ymm0, [rsi + rcx*4]        ; Load 8 integers from a[]
    vpaddd  ymm0, ymm0, [rdx + rcx*4]  ; Add 8 integers from b[]
    vmovdqu [rdi + rcx*4], ymm0        ; Store 8 results to c[]
    add     rcx, 8                     ; i += 8
    cmp     rcx, r8                    ; Compare i with n
    jl      .vector_loop               ; Continue if more elements
```

Notice what changed:
1. **`vmovdqu ymm0`** - Loads 256 bits (8 integers) instead of 32 bits (1 integer)
2. **`vpaddd`** - Adds 8 pairs of integers in a single instruction
3. **`add rcx, 8`** - Loop increment is now 8 instead of 1

The loop body is nearly identical in size, but processes **8× more data per iteration**.

### Understanding the Instructions

Let's decode these vector instructions:

**`vmovdqu ymm0, [rsi + rcx*4]`**
- **`v`** - Vector instruction (AVX/AVX2 prefix)
- **`mov`** - Move (load or store)
- **`d`** - Double-word (32-bit values)
- **`qu`** - Unaligned (doesn't require special alignment)
- **`ymm0`** - 256-bit register
- **Loads** 8 consecutive 32-bit integers from memory

**`vpaddd ymm0, ymm0, [rdx + rcx*4]`**
- **`v`** - Vector instruction
- **`padd`** - Packed add (add multiple values in parallel)
- **`d`** - Double-word (32-bit)
- **3 operands** - `dst, src1, src2` (non-destructive)
- **Operation**: ymm0 = ymm0 + memory[rdx + rcx*4]
- **Performs** 8 additions simultaneously

The old SSE instructions were 2-operand (destructive): `paddd xmm0, xmm1` would overwrite xmm0. AVX's 3-operand format is more flexible and enables better optimization.

## The Anatomy of Vectorized Code

When examining vectorized assembly or decompiled code, you'll encounter several telltale signs:

### 1. Unusual Loop Increments

Instead of incrementing by 1, you'll see increments of 4, 8, or 16:

```asm
add    rcx, 8        ; Processing 8 elements per iteration
```

This immediately signals that multiple elements are being processed per iteration. If you see `add rcx, 32`, that's likely 8 floats (8 × 4 bytes = 32 bytes).

### 2. SIMD Instruction Patterns

Keep an eye out for instructions with these characteristics:

**AVX/AVX2 instructions** (256-bit):
- Prefix with `v`: `vmovdqu`, `vpaddd`, `vmulps`
- Use YMM registers: `ymm0` through `ymm15`
- Examples: `vaddps` (add 8 floats), `vpmulld` (multiply 8 integers)

**SSE instructions** (128-bit):
- Sometimes prefix with `p`: `paddd`, `pmulld`
- Use XMM registers: `xmm0` through `xmm15`
- Examples: `addps` (add 4 floats), `movdqa` (aligned move)

**AVX-512 instructions** (512-bit):
- Still prefix with `v` but use ZMM registers: `zmm0` through `zmm31`
- May include mask registers: `vmovdqa32 zmm0 {k1}`
- Examples: `vaddpd zmm0, zmm1, zmm2` (add 8 doubles)

### 3. The Cleanup Loop

Here's where things get interesting. Arrays rarely divide evenly by 8 or 16, so compilers generate *two* loops:

**The main vector loop** processes chunks of 8 (or whatever the vector width is):
```c
// Conceptually what the compiler generates
int vector_end = n - (n % 8);  // Round down to nearest multiple of 8

// Vector loop: processes 0-7, 8-15, 16-23, etc.
for (int i = 0; i < vector_end; i += 8) {
    // SIMD operations process 8 elements at once
}
```

**The scalar cleanup loop** handles the stragglers (0-7 remaining elements):
```c
// Scalar loop: processes remaining elements one at a time
for (int i = vector_end; i < n; i++) {
    c[i] = a[i] + b[i];  // Back to one-at-a-time processing
}
```

In assembly, you'll see this pattern:
```asm
    ; Calculate vector_end = n & ~7 (clear low 3 bits)
    mov    r9d, r8d
    and    r9d, -8
    
.vector_loop:
    ; ... vector operations ...
    add    rcx, 8
    cmp    rcx, r9
    jl     .vector_loop
    
    ; Check if there's a remainder
    cmp    r9d, r8d
    je     .done          ; If vector_end == n, we're done
    
.scalar_loop:
    ; ... process remaining 0-7 elements ...
    inc    rcx
    cmp    rcx, r8
    jl     .scalar_loop
    
.done:
    ret
```

This pattern is **critical** to recognize when reverse engineering, as it can make control flow appear more complex than the original source code suggests.

### 4. The Alignment Dance

Sometimes you'll see code that processes a few initial elements before entering the main vector loop. This is **loop peeling** for alignment:

```asm
    ; Check if pointer is aligned to 32 bytes
    mov    rax, rdi
    and    rax, 31           ; Get low 5 bits (32-byte boundary)
    je     .aligned          ; If 0, already aligned
    
    ; Calculate elements needed to reach alignment
    neg    rax
    add    rax, 32           ; Bytes to next boundary
    shr    rax, 2            ; Convert to number of ints
    
.peel_loop:
    ; Process 1-7 elements to reach alignment
    ; ...
    
.aligned:
.vector_loop:
    ; Now use aligned loads (potentially faster)
    vmovdqa ymm0, [rdi + rcx*4]  ; Aligned load
    ; ...
```

While modern CPUs handle unaligned loads efficiently, aligned loads can still be slightly faster, especially when data spans cache line boundaries.

## When Vectorization Fails: The Dependency Problem

Not every loop can be vectorized. The golden rule is: **operations must be independent**.

### Example 1: Loop-Carried Dependencies

Consider this example:
```c
for (int i = 1; i < n; i++) {
    a[i] = a[i-1] + 5;  // Each element depends on the previous one
}
```

This creates a **data dependency chain**:
- To compute `a[2]`, you must first know `a[1]`
- To know `a[1]`, you must first know `a[0]`
- To know `a[0]`... you get the idea

These operations *must* happen sequentially—there's no way around it. If we tried to vectorize this:

```c
// WRONG - would produce incorrect results
a[1] = a[0] + 5;  // OK
a[2] = a[1] + 5;  // OK
a[3] = a[2] + 5;  // OK
a[4] = a[3] + 5;  // OK

// Vectorized (WRONG):
// Loads a[0], a[1], a[2], a[3] all at the same time
// But a[1], a[2], a[3] haven't been updated yet!
```

The compiler recognizes this and keeps the loop scalar.

### Example 2: Pointer Aliasing

```c
void add_scaled(float *a, float *b, float scale, int n) {
    for (int i = 0; i < n; i++) {
        a[i] = a[i] + b[i] * scale;
    }
}
```

**Question**: What if `a` and `b` point to overlapping memory?

```c
float data[100];
add_scaled(&data[1], &data[0], 2.0f, 50);  // Overlap!
```

Now `a[0]` overlaps with `b[1]`, `a[1]` overlaps with `b[2]`, etc. Vectorization would produce wrong results because it would read old values that should have already been updated.

**Solution**: Use the `restrict` keyword to tell the compiler they don't overlap:

```c
void add_scaled(float *restrict a, float *restrict b, float scale, int n) {
    for (int i = 0; i < n; i++) {
        a[i] = a[i] + b[i] * scale;
    }
}
```

The `restrict` keyword is a **promise** to the compiler that this pointer is the only way to access this memory. Breaking this promise leads to undefined behavior.

### Example 3: Complex Control Flow

```c
for (int i = 0; i < n; i++) {
    if (data[i] > threshold) {
        result[i] = expensive_function(data[i]);
    } else if (data[i] < 0) {
        break;  // Early exit!
    } else {
        result[i] = 0;
    }
}
```

This is difficult to vectorize because:
- **`expensive_function` call**: Can't easily vectorize function calls
- **`break` statement**: Early exit makes iteration count unpredictable
- **Complex branches**: Different code paths for different elements

Modern compilers can handle *simple* conditions with masking:

```c
// This CAN be vectorized
for (int i = 0; i < n; i++) {
    if (data[i] > threshold) {
        result[i] = data[i] * 2;
    } else {
        result[i] = 0;
    }
}
```

The compiler generates code that:
1. Compares all 8 elements against threshold simultaneously
2. Multiplies all 8 elements by 2
3. Uses a mask to select which results to keep

In AVX2, this looks like:
```asm
vmovdqu   ymm0, [data]              ; Load 8 values
vpcmpgtd  ymm2, ymm0, ymm_threshold ; Compare, creates mask
vpaddd    ymm1, ymm0, ymm0          ; Multiply by 2 (add to itself)
vpand     ymm1, ymm1, ymm2          ; Apply mask: zero where condition false
vmovdqu   [result], ymm1            ; Store
```

### Other Vectorization Roadblocks

- **Function calls inside loops** (unless inlined)
- **Non-contiguous memory access** (`array[i*100]` with large stride)
- **Reductions with side effects** (e.g., accumulating into a map)
- **Volatile variables** (compiler can't assume they don't change)
- **Floating-point reduction** (technically not associative, needs `-ffast-math`)

### Checking Why Vectorization Failed

Use compiler reports to see what happened:

**GCC:**
```bash
gcc -O3 -fopt-info-vec-missed loop.c
```

Output might show:
```
loop.c:15:5: missed: couldn't vectorize loop
loop.c:15:5: missed: not suitable for scatter/gather
loop.c:23:5: missed: loop contains function call
loop.c:31:5: note: loop vectorized
```

**Clang:**
```bash
clang -O3 -Rpass-missed=loop-vectorize loop.c
```

This reveals exactly why loops weren't vectorized.

## Forcing the Compiler's Hand

Compilers are smart, but sometimes they need encouragement.

### Compiler Flags

**Enable aggressive optimization:**
```bash
gcc -O3 -march=native loop.c
```

- **`-O3`**: Highest optimization level, enables vectorization
- **`-march=native`**: Use all SIMD instructions your CPU supports

**For specific architectures:**
```bash
gcc -O3 -march=haswell   # AVX2 + FMA
gcc -O3 -march=skylake   # AVX2 + better optimizations
gcc -O3 -mavx2           # Enable AVX2 instructions
```

**Floating-point optimizations:**
```bash
gcc -O3 -ffast-math
```

This allows the compiler to:
- Reorder floating-point operations (important for reductions)
- Assume no NaN or infinity values
- Assume no signed zeros

**Warning**: `-ffast-math` can change results slightly due to rounding differences.

### OpenMP SIMD Pragmas

You can explicitly request vectorization with OpenMP:

```c
#pragma omp simd
for (int i = 0; i < n; i++) {
    c[i] = a[i] + b[i];
}
```

**With additional hints:**
```c
// Tell compiler arrays are aligned
#pragma omp simd aligned(a,b,c:32)
for (int i = 0; i < n; i++) {
    c[i] = a[i] + b[i];
}

// Specify reduction operation
float sum = 0.0f;
#pragma omp simd reduction(+:sum)
for (int i = 0; i < n; i++) {
    sum += data[i];
}
```

### Compiler-Specific Pragmas

**GCC/Clang:**
```c
#pragma GCC ivdep  // Ignore vector dependencies
#pragma GCC optimize("O3", "unroll-loops")
```

**MSVC:**
```c
#pragma loop(hint_parallel(8))
#pragma loop(ivdep)
```

## Performance Impact: The Numbers Don't Lie

The theoretical speedup from vectorization equals the vector width. Processing 8 elements at once should yield an 8× speedup, right?

In practice, it's more nuanced:

### Real-World Speedups

**Best case scenario** (compute-bound, well-cached data):
- SSE (4-wide): 3-3.8× speedup
- AVX2 (8-wide): 5-7× speedup
- AVX-512 (16-wide): 10-14× speedup

**Typical case** (mixed workload):
- SSE: 2-3× speedup
- AVX2: 3-5× speedup
- AVX-512: 6-10× speedup

**Worst case** (memory-bound):
- SSE: 1.2-1.5× speedup
- AVX2: 1.5-2× speedup
- AVX-512: 2-3× speedup

**Why the gap from theoretical?**

1. **Cleanup loop overhead**: Those 0-7 remaining elements are processed slowly
2. **Memory bandwidth**: Loading/storing data can be the bottleneck
3. **Cache misses**: If data isn't in cache, SIMD doesn't help much
4. **Alignment penalties**: Unaligned loads can be slower
5. **Loop overhead**: Checking bounds, incrementing counters still takes time

### Example Benchmark

Let's measure actual performance:

```c
#include <time.h>

#define N 10000000

void test_scalar(float *a, float *b, float *c) {
    for (int i = 0; i < N; i++) {
        c[i] = a[i] + b[i];
    }
}

void test_vector(float *a, float *b, float *c) {
    #pragma omp simd
    for (int i = 0; i < N; i++) {
        c[i] = a[i] + b[i];
    }
}
```

**Typical results on a modern CPU:**
- Scalar: 15.2 ms
- Vector (AVX2): 2.8 ms
- **Speedup: 5.4×**

**Why not 8×?** The bottleneck shifts to memory bandwidth. We're moving 120MB of data (3 arrays × 10M × 4 bytes), and memory can only supply data so fast.

### Memory-Bound vs. Compute-Bound

**Compute-bound** operations (lots of math, little memory):
```c
for (int i = 0; i < n; i++) {
    c[i] = a[i] * b[i] + a[i] * b[i] - a[i] / b[i];  // Many operations per load
}
```
Vectorization gives **near-theoretical speedup**.

**Memory-bound** operations (little math, lots of memory):
```c
for (int i = 0; i < n; i++) {
    c[i] = a[i] + b[i];  // Only one operation per load
}
```
Vectorization gives **limited speedup** because memory is the bottleneck.

## Spotting Vectorization in the Wild

When analyzing binaries, watch for these patterns:

### 1. Register Names

**SSE (128-bit):**
- `xmm0`, `xmm1`, ..., `xmm15`

**AVX/AVX2 (256-bit):**
- `ymm0`, `ymm1`, ..., `ymm15`

**AVX-512 (512-bit):**
- `zmm0`, `zmm1`, ..., `zmm31`

The register name immediately tells you the SIMD width being used.

### 2. Instruction Patterns

**Load instructions:**
- `movdqu`, `movdqa` (128-bit)
- `vmovdqu`, `vmovdqa` (256-bit)
- `vmovdqu32`, `vmovdqa64` (512-bit)

**Arithmetic instructions:**
- Packed add: `paddd`, `vpaddd`
- Packed multiply: `pmulld`, `vpmulld`
- FMA: `vfmadd231ps`, `vfmadd213pd`

### 3. Loop Structure Signature

```asm
    ; Check minimum size
    cmp    edx, 8
    jb     .scalar_only
    
    ; Vector loop
    add    rcx, 32        ; 8 elements × 4 bytes
    cmp    rcx, rax
    jl     .vector_loop
    
    ; Scalar cleanup
.scalar_loop:
    inc    rcx
    cmp    rcx, rdx
    jl     .scalar_loop
```

The progression from size check → vector loop → scalar cleanup is distinctive.

### 4. The `vzeroupper` Instruction

```asm
    ; ... AVX code ...
    vzeroupper
    ret
```

This instruction appears at the end of functions using AVX to clear the upper bits of YMM registers. It prevents performance penalties when mixing AVX and SSE code.

If you see `vzeroupper`, you know AVX was used somewhere in that function.

### 5. Alignment Checks

```asm
    mov    rax, rdi
    and    rax, 31       ; Check if aligned to 32 bytes
    je     .aligned
```

Alignment checking before loops suggests the compiler is trying to use aligned loads for better performance.

## The Bigger Picture

Loop vectorization is just one tool in the compiler's optimization arsenal, but it's a powerful one. It bridges the gap between high-level code that's easy to write and maintain, and low-level code that fully exploits modern CPU capabilities.

### Key Takeaways

1. **Modern CPUs have massive parallel processing capabilities** built right into their ALUs through SIMD registers

2. **Compilers automatically vectorize** simple loops when they can prove it's safe to do so

3. **You can help the compiler** by:
   - Using contiguous memory access patterns
   - Avoiding dependencies between iterations
   - Using the `restrict` keyword
   - Aligning data structures
   - Keeping loops simple

4. **Memory access patterns matter** more than you might think even perfect vectorization is limited by memory bandwidth

5. **Reverse engineering benefits**: Recognizing vectorized code helps you understand what the compiler optimized and why performance is what it is

### When to Care About Vectorization

**You should pay attention when:**
- Processing large amounts of data (images, audio, scientific computing)
- Performance profiling shows loops as hotspots
- Working with floating-point heavy calculations
- Implementing algorithms like matrix operations, FFT, compression

**You can probably ignore it when:**
- The code isn't performance-critical
- Arrays are small (< 1000 elements)
- Loop bodies are complex with lots of branching
- Memory access is random/unpredictable

### Looking Forward

As CPUs continue to evolve, SIMD capabilities are only getting wider:
- AVX-512 is becoming more common
- ARM processors have NEON (similar to SIMD)
- GPU computing extends the same principles even further

The fundamentals remain the same: process multiple data elements with a single instruction.

The next time you write a simple `for` loop, remember: somewhere deep in your CPU, there's a massive register just waiting to process eight elements at once. Your compiler's job is to use it. Your job is to let it.
