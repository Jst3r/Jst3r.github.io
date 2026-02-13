---
title: "Loop Vectorization"
description: "How modern compilers turn your innocent for-loops into parallel processing powerhouses"
date: "2026-01-18"
tags: ["Vectorization", "Optimization", "Compiler", "SIMD", "Performance"]
readTime: "6 min read"
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
1. Loading `a[0]` and `b[0]`
2. Adding them
3. Storing the result in `c[0]`
4. Repeating for `a[1]`, `b[1]`, `c[1]`... and so on

If your arrays have 1,000 elements, that's 1,000 separate addition operations. Each one waits politely for the previous one to finish, like a very orderly queue at a British post office.

## The Solution: SIMD (Single Instruction, Multiple Data)

Modern CPUs have a secret weapon hidden inside them: massive registers that can hold multiple values simultaneously. While your typical register might hold one 32-bit integer, SIMD registers are much larger:

- **128-bit registers** (SSE): Can hold 4 integers at once (128 ÷ 32 = 4)
- **256-bit registers** (AVX): Can hold 8 integers at once (256 ÷ 32 = 8)
- **512-bit registers** (AVX-512): Can hold 16 integers at once (512 ÷ 32 = 16)

When the compiler detects that your loop can be vectorized, it transforms your code to use these wider registers. Instead of processing one element per iteration, it processes 4, 8, or even 16 elements in a single instruction.

### The Assembly Difference

**Without vectorization**, your assembly might look like:
```asm
.loop:
    mov    eax, [rsi + rcx*4]    ; Load a[i]
    add    eax, [rdx + rcx*4]    ; Add b[i]
    mov    [rdi + rcx*4], eax    ; Store to c[i]
    inc    rcx                   ; i++
    cmp    rcx, r8               ; Check if i < n
    jl     .loop                 ; Continue if true
```

**With vectorization** (using AVX), it transforms into:
```asm
.vector_loop:
    vmovdqu ymm0, [rsi + rcx*4]  ; Load 8 values from a[]
    vpaddd  ymm0, ymm0, [rdx + rcx*4]  ; Add 8 values from b[]
    vmovdqu [rdi + rcx*4], ymm0  ; Store 8 results to c[]
    add     rcx, 8               ; i += 8
    cmp     rcx, r8
    jl      .vector_loop
```

Notice the loop increment? Instead of `i++`, it's `i += 8`. The CPU is now processing eight additions per iteration instead of one.

## The Anatomy of Vectorized Code

When examining vectorized assembly or decompiled code, you'll encounter several telltale signs:

### 1. **Unusual Loop Increments**
Instead of incrementing by 1, you'll see increments of 4, 8, or 16. This immediately signals that multiple elements are being processed per iteration.

### 2. **Cryptic SIMD Instructions**
Keep an eye out for instructions with these patterns:
- **`v` prefix**: Vector operations (AVX/AVX2)
- **`p` prefix**: Packed operations (older SSE)
- **Common operations**: `vmovdqu` (move), `vpaddd` (packed add), `vmulps` (packed multiply), `vpxor` (packed XOR)

### 3. **The Cleanup Loop**
Here's where things get interesting. Arrays rarely divide evenly by 8 or 16, so compilers generate *two* loops:

**The main vector loop** processes chunks of 8 (or whatever the vector width is):
```c
// Processes elements 0-7, 8-15, 16-23, etc.
for (int i = 0; i < n - (n % 8); i += 8) {
    // SIMD magic happens here
}
```

**The scalar cleanup loop** handles the stragglers:
```c
// Processes the remaining 0-7 elements
for (int i = n - (n % 8); i < n; i++) {
    c[i] = a[i] + b[i];  // Back to one-at-a-time
}
```

This pattern is critical to recognize when reverse engineering, as it can make control flow appear more complex than the original source code.

## When Vectorization Fails: The Dependency Problem

Not every loop can be vectorized. The golden rule is: **operations must be independent**.

Consider this example:
```c
for (int i = 1; i < n; i++) {
    a[i] = a[i-1] + 5;  // Each element depends on the previous one
}
```

This creates a **data dependency chain**. To compute `a[2]`, you must first know `a[1]`. To know `a[1]`, you must first know `a[0]`. These operations *must* happen sequentially—there's no way around it. The compiler will leave this loop in scalar form.

Other vectorization roadblocks include:
- **Function calls inside loops** (unless they can be inlined)
- **Pointer aliasing** (when the compiler can't prove pointers don't overlap)
- **Conditional statements** that differ per element (though modern compilers can sometimes handle these with masking)
- **Non-contiguous memory access patterns**

## Forcing the Compiler's Hand

Compilers are smart, but sometimes they need encouragement. Most compilers offer pragmas or attributes to control vectorization:

**GCC/Clang:**
```c
#pragma GCC ivdep  // Ignore vector dependencies
#pragma GCC optimize("O3", "unroll-loops")

void add_arrays(int *a, int *b, int *c, int n) {
    #pragma omp simd  // OpenMP SIMD directive
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}
```

**MSVC:**
```c
#pragma loop(hint_parallel(8))
#pragma loop(ivdep)
```

You can also use compiler flags:
- `-O3` or `-O2`: Enable aggressive optimizations including vectorization
- `-march=native`: Use all SIMD instructions available on the current CPU
- `-ftree-vectorize`: Explicitly enable vectorization
- `-fopt-info-vec`: Get reports on which loops were vectorized (and why others weren't)

## Performance Impact: The Numbers Don't Lie

The speedup from vectorization is theoretically equal to the vector width. Processing 8 elements at once should yield an 8× speedup, right?

In practice, it's more nuanced:
- **Best case**: 4-7× speedup (accounting for overhead, memory bandwidth, cleanup loops)
- **Typical case**: 2-4× speedup (real-world code is messy)
- **Worst case**: Slight slowdown (if the vectorization overhead exceeds the benefit for small arrays)

The real performance gain depends on:
- **Array size**: Larger arrays amortize the vectorization overhead
- **Memory alignment**: Aligned data loads are faster
- **Cache behavior**: Vectorized code can improve cache utilization
- **CPU generation**: Newer CPUs have more powerful SIMD units

## Spotting Vectorization in the Wild

When analyzing binaries, watch for these patterns:

1. **Register names**: `xmm0-xmm15` (SSE), `ymm0-ymm15` (AVX), `zmm0-zmm31` (AVX-512)
2. **Alignment checks**: Code that aligns pointers to 16/32/64-byte boundaries before loops
3. **Peel loops**: Small initial loops that process a few elements to achieve alignment
4. **Loop trip count checks**: Code that verifies `n >= 8` before entering the vector path

## The Bigger Picture

Loop vectorization is just one tool in the compiler's optimization arsenal, but it's a powerful one. It bridges the gap between high-level code that's easy to write and maintain, and low-level code that fully exploits modern CPU capabilities.

The next time you write a simple `for` loop, remember: somewhere deep in your CPU, there's a massive register just waiting to process eight elements at once. Your compiler's job is to use it. Your job is to let it.

---

*Want to see if your loops are being vectorized? Compile with `-O3 -fopt-info-vec-all` and watch the magic happen (or find out why it didn't).*