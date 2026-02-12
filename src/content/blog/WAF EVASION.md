---
title: "WAF Evasion: Bypassing Web Application Firewalls"
description: "slip past WAFs when they think they got you locked out"
date: "2026-02-12"
tags: ["WAF", "Web", "Penetration Testing"] 
readTime: "12 min read"
---

## What the Hell is a WAF?

A web application firewall (WAF) sits between users and web applications, analyzing every HTTP request. Its job? Keep malicious traffic from reaching your target. When a WAF spots SQL injection, XSS, path traversal, or command injection, it either sanitizes or blocks the request entirely.

## How WAFs work:

WAFs inspect URL parameters, request headers, POST body data, cookies, HTTP methods, and file uploads. When they detect malicious patterns, they block, strip content, log, or trigger alerts. The question is: how smart is the WAF, and where does it stop paying attention?

## WAF Technologies: The Dumb vs The Smart

### Signature-Based WAFs

These maintain databases of known attack signatures and regex patterns. They work by matching requests against predefined patterns like `/(\bOR\b|\bAND\b).*=.*--/i` for SQL injection or `/<script.*?>/i` for XSS.

The problem? They only catch known patterns and exact matches. Attackers bypass them through obfuscation and encoding. They suffer from case sensitivity issues and fail to handle whitespace variations. Effective only against unsophisticated attacks.

### Machine Learning-Based WAFs

These analyze traffic patterns, baseline normal behavior, and flag anomalies. They train on legitimate traffic, then detect anomalies in request structure, frequency, and content. They identify suspicious parameter combinations and track user behavior patterns over time.

The advantage is detecting zero-day attacks that signature-based systems miss. They adapt to application-specific traffic and are harder to bypass with simple encoding. However, they generate high false positives during training, can be poisoned with malicious data, struggle with low-and-slow attacks, and require significant tuning. Attackers evade them by mimicking normal traffic patterns.

## Evasion Techniques: Breaking Through

### 1. Fuzzing/Bruteforcing

Probe the WAF's defenses using ffuf, wfuzz, or Burp Intruder with targeted wordlists. Rotate user-agents every 10-20 requests and add 2-5 second delays. Monitor response codes: 403 = WAF block, 406 = often WAF, 200 = potential bypass, 500 = possible successful injection.

Works better against signature-based WAFs. ML systems detect fuzzing behavior itself—volume spikes, sequential patterns. Use it to map the attack surface, then switch to manual exploitation.

### 2. Payload Obfuscation

Change how your payload looks without changing what it does. Transform `' OR 1=1--` through case variation, comment injection (`'/**/OR/**/1=1--`), whitespace alternatives, encoding variations, or alternative operators. For XSS, use different tags (`<svg/onload=alert(1)>`), Unicode encoding, HTML entities, or JavaScript alternatives like `eval(atob('YWxlcnQoMSk='))`.

### 3. Alternate HTTP Methods

Most WAF rules focus on GET and POST. Use PUT, HEAD, OPTIONS, or TRACE which often have looser inspection. Many frameworks respect method override headers, send POST with `X-HTTP-Method-Override: DELETE`. The WAF inspects POST while the backend processes DELETE.

### 4. Header Injection

WAFs inspect URLs and POST bodies but give headers less attention. Target User-Agent, X-Forwarded-For, Referer, X-Original-URL, Cookie headers, and custom headers like X-API-Key. WAFs often whitelist internal-looking headers. Applications log headers without sanitization, use them in queries, or use them for access control.

### 5. JSON and XML Formats

WAFs inspect URL parameters thoroughly but struggle with structured formats. A payload blocked in form data might bypass in JSON as `{"id": "1' OR 1=1--"}`. Nested structures create deeper gaps. XML exploitation uses CDATA sections, XXE attacks, SOAP injection, and namespace confusion.

### 6. Encoding Variants

Stack multiple encoding layers, URL, double, triple encoding. Most WAFs fail at layer 2 or 3. Use Unicode variations, base64 for execution, or hex encoding in SQL (`0x31` instead of `'1'`).

### 7. HTTP Parameter Pollution

Submit the same parameter multiple times. ASP.NET concatenates with commas, PHP returns last value, JSP/Apache return first, Node.js creates array. WAF might check `id=123` (safe) while PHP processes `id=1' UNION SELECT password FROM users--` (malicious).

### 8. Rate Limiting & Timing Attacks

Spread attacks over time with 5-15 second random delays, rotate user agents, vary headers, and use proxies. ML-based WAFs build behavioral profiles based on velocity. Mimicking normal behavior keeps you under the anomaly threshold.

### 9. Payload Fragmentation

Break payloads into parts. Use chunked transfer encoding, request smuggling (Content-Length vs Transfer-Encoding discrepancies), multi-part form data, or session-based fragmentation where partial payloads are completed across requests.

### 10. Content-Type Manipulation

Send JSON while claiming form-encoded, or executable code while claiming plain text. WAF parses by declared type while backend processes actual content. Charset confusion: encode in EBCDIC/IBM037 WAF decodes as UTF-8 (garbled) while backend executes the payload.

### 11. IP/Source Manipulation

WAFs whitelist internal IP ranges. Spoof X-Forwarded-For, X-Real-IP, X-Client-IP to localhost (127.0.0.1, ::1) or private ranges (10.0.0.1, 192.168.1.1). Applications behind reverse proxies often trust these headers.

### 12. Cache Poisoning & Web Cache Deception

WAFs sit in front of caching layers. Poison cache with malicious responses using headers that aren't part of the cache key (X-Forwarded-Host, X-Original-URL). WAF inspects once, caches the response, then serves to everyone without re-inspection. For cache deception, request `/profile.css` where `.css` is cached but returns sensitive data.

### 13. Protocol Switching & Upgrade Attacks

Establish HTTP connection that passes WAF, then upgrade to WebSocket. WAF may not inspect WebSocket frames post-upgrade. Exploit HTTP/2 vs HTTP/1.1 discrepancies using pseudo-headers or binary framing. Use TLS SNI mismatch send one hostname in SNI, different in Host header.

### 14. CRLF Injection & Response Splitting

Inject `\r\n` to manipulate HTTP headers or responses. Send `url=https://evil.com%0d%0aSet-Cookie:%20admin=true` to inject headers. WAF sees single value, backend interprets as multiple headers or response split. Useful for cache poisoning, XSS, or session fixation.

### 15. Unicode Normalization Attacks

Unicode has multiple representations for the same character. Send `<ſcript>alert(1)</ſcript>` using Latin small letter long s. WAF doesn't recognize it, but after normalization becomes `<script>`. Use homoglyphs `аdmin` with Cyrillic 'а' instead of Latin 'a' bypasses string matching.

### 16. Regular Expression DoS (ReDoS)

Craft payloads causing catastrophic backtracking in WAF regex, making it timeout and fail-open. The WAF spends excessive CPU cycles, times out, and lets subsequent requests through uninspected.

### 17. GraphQL Batching & Aliasing

Hide malicious queries among legitimate ones or use deeply nested queries to evade depth limits. WAF might only inspect first query or have depth limits. Aliases let you send multiple versions with different payloads.

### 18. JWT/Token Manipulation

Exploit JWT parsing differences. Change `alg` from RS256 to HS256 (algorithm confusion). Add claims like `"isAdmin": true` if WAF doesn't validate but backend trusts them. Set `"alg": "none"` and remove signature if implementation accepts unsigned tokens.

### 19. Polyglot Payloads

Create payloads valid in multiple contexts. WAF interprets one way (safe), backend another (malicious). Example: ```/*-/*\`/_'/_"/**/(/* */onerror=alert('XSS') )//#``` bypasses JavaScript, HTML, and SQL filters simultaneously.

### 20. Time-of-Check to Time-of-Use (TOCTOU)

Exploit race conditions between WAF inspection and application processing. Upload benign file that passes WAF, then replace with malicious payload before backend processes. Or create sessions simultaneously and one passes WAF, another carries payload.

### 21. DNS Rebinding for SSRF

Bypass WAF IP blacklists. Set up domain with low TTL. Initially resolves to public IP (passes WAF), then rebinds to internal IP (127.0.0.1) before backend makes actual request.

### 22. Null Byte & Special Character Injection

Legacy systems treat null bytes (`%00`) as string terminators. Inject to truncate WAF inspection while backend continues processing. Example: `safe.txt%00../../etc/passwd` WAF sees `safe.txt`, backend sees full path. Some parsers treat `;`, `?`, `#`, or space as terminators.

### 23. Mutation-Based Fuzzing

Use mutation-based fuzzing with valid requests instead of random. Take legitimate traffic, mutate small parts, observe WAF behavior. Use genetic algorithm approach: start with blocked payload, make small mutations, keep what passes, mutate further. More efficient than blind fuzzing and better against ML-based WAFs.

## Farewall

<figure>
  <img src="/images/farewall.jpg" alt="A mysterious figure walking toward a red moon with tentacles and city ruins" />

</figure>