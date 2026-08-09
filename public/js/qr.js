/* Minimal QR code generator (byte mode, error correction level M).
   Self-contained — no external dependencies. Usage:
     var qr = new QRCode();
     var matrix = qr.make(text);       // 2D boolean array
     qr.draw(canvas, matrix, size);    // render to a <canvas>
*/
(function (global) {
  'use strict';

  // ---- GF(256) arithmetic ----
  var EXP = new Array(512);
  var LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function mul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[(LOG[a] + LOG[b]) % 255];
  }

  // ---- Reed-Solomon generator polynomial ----
  function rsGenPoly(deg) {
    var poly = [1];
    for (var i = 0; i < deg; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= mul(poly[j], EXP[i]);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    return poly;
  }

  function rsRemainder(data, gen) {
    var rem = new Array(gen.length - 1).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ rem[0];
      rem.shift();
      rem.push(0);
      for (var j = 0; j < rem.length; j++) {
        rem[j] ^= mul(gen[j + 1], factor);
      }
    }
    return rem;
  }

  // ---- Version data (byte mode, EC level M) ----
  // [ver, totalCodewords, ecCodewordsPerBlock, numBlocks] for versions 1-10
  var VERSIONS = [
    [1, 26, 10, 1],
    [2, 44, 16, 1],
    [3, 70, 26, 1],
    [4, 100, 18, 2],
    [5, 134, 24, 2],
    [6, 172, 16, 4],
    [7, 196, 18, 4],
    [8, 242, 22, 4],
    [9, 292, 22, 5],
    [10, 346, 26, 5]
  ];

  var ALIGN = {
    2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function chooseVersion(len) {
    // data capacity in bytes for level M (approx: (total - ec*blocks) - 4 header)
    for (var v = 0; v < VERSIONS.length; v++) {
      var cap = VERSIONS[v][1] - VERSIONS[v][2] * VERSIONS[v][3] - 3;
      if (len <= cap) return v + 1;
    }
    return 10;
  }

  function maskPenalty(m) {
    var n = m.length, score = 0;
    // Adjacent modules in row/column
    for (var r = 0; r < n; r++) {
      var run = 1, prev = m[r][0];
      for (var c = 1; c <= n; c++) {
        if (c < n && m[r][c] === prev) { run++; }
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1; prev = c < n ? m[r][c] : null;
        }
      }
    }
    for (var c2 = 0; c2 < n; c2++) {
      var run2 = 1, prev2 = m[0][c2];
      for (var r2 = 1; r2 <= n; r2++) {
        if (r2 < n && m[r2][c2] === prev2) { run2++; }
        else {
          if (run2 >= 5) score += 3 + (run2 - 5);
          run2 = 1; prev2 = r2 < n ? m[r2][c2] : null;
        }
      }
    }
    // 2x2 blocks
    for (var br = 0; br < n - 1; br++) {
      for (var bc = 0; bc < n - 1; bc++) {
        var v = m[br][bc];
        if (m[br][bc + 1] === v && m[br + 1][bc] === v && m[br + 1][bc + 1] === v) score += 3;
      }
    }
    return score;
  }

  function makeQR(data) {
    var version = chooseVersion(data.length);
    var size = 17 + version * 4;
    var bin = new Array(size);
    for (var i = 0; i < size; i++) bin[i] = new Array(size).fill(false);

    // Finder patterns
    function finder(r, c) {
      for (var dr = -1; dr <= 7; dr++) {
        for (var dc = -1; dc <= 7; dc++) {
          var rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          var on = (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) &&
            (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
          bin[rr][cc] = on;
        }
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    // Timing patterns
    for (var t = 8; t < size - 8; t++) {
      bin[6][t] = (t % 2 === 0);
      bin[t][6] = (t % 2 === 0);
    }

    // Alignment patterns
    var aligns = ALIGN[version];
    if (aligns) {
      for (var ar = 0; ar < aligns.length; ar++) {
        for (var ac = 0; ac < aligns.length; ac++) {
          var arp = aligns[ar], acp = aligns[ac];
          // skip overlapping finder patterns
          if ((arp === 6 && acp === 6) || (arp === 6 && acp === size - 7) || (arp === size - 7 && acp === 6)) continue;
          for (var dr = -2; dr <= 2; dr++) {
            for (var dc = -2; dc <= 2; dc++) {
              var on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
              bin[arp + dr][acp + dc] = on;
            }
          }
        }
      }
    }

    // Reserve format info area
    var reserved = new Array(size);
    for (var ri = 0; ri < size; ri++) reserved[ri] = new Array(size).fill(false);
    function res(r, c) { if (r >= 0 && r < size && c >= 0 && c < size) reserved[r][c] = true; }
    for (var f = 0; f < 9; f++) {
      res(8, f); res(f, 8);
      res(size - 1 - f, 8); res(8, size - f);
    }
    res(8, size - 8); res(7, 8); res(8, 7); res(8, size - 7); res(size - 8, 8);

    // ---- Build data codewords ----
    var vData = VERSIONS[version - 1];
    var totalCW = vData[1], ecCW = vData[2], numBlocks = vData[3];
    var dataCW = totalCW - ecCW * numBlocks;
    var dataCapa = dataCW - 2; // 2 bytes mode + length header (small texts)

    var buf = [];
    // mode indicator 0100 (byte)
    buf.push(4, 0, 1, 0);
    // char count (8 bits for <=255)
    var clen = data.length;
    for (var bbit = 7; bbit >= 0; bbit--) buf.push((clen >> bbit) & 1);
    for (var ci = 0; ci < data.length; ci++) {
      var code = data.charCodeAt(ci);
      if (code > 255) code = 63; // fallback for non-latin
      for (var chbit = 7; chbit >= 0; chbit--) buf.push((code >> chbit) & 1);
    }
    // terminator up to 4 bits
    for (var tb = 0; tb < 4 && buf.length < dataCapa * 8; tb++) buf.push(0);
    // pad to byte boundary
    while (buf.length % 8 !== 0) buf.push(0);
    // pad bytes
    var pad = [0xec, 0x11], pi = 0;
    while (buf.length < dataCapa * 8) {
      var pb = pad[pi % 2];
      for (var pbit = 7; pbit >= 0; pbit--) buf.push((pb >> pbit) & 1);
      pi++;
    }

    // Convert to bytes
    var bytes = [];
    for (var bi = 0; bi < buf.length; bi += 8) {
      var byte = 0;
      for (var k = 0; k < 8; k++) byte = (byte << 1) | buf[bi + k];
      bytes.push(byte);
    }

    // Split into blocks and compute EC
    var blockLen = Math.floor(dataCW / numBlocks);
    var blocks = [];
    var idx = 0;
    for (var bl = 0; bl < numBlocks; bl++) {
      var blk = bytes.slice(idx, idx + blockLen);
      idx += blockLen;
      var ec = rsRemainder(blk, rsGenPoly(ecCW));
      blocks.push({ d: blk, e: ec });
    }
    // interleave data
    var inter = [];
    for (var di = 0; di < blockLen; di++) {
      for (var b2 = 0; b2 < numBlocks; b2++) {
        if (di < blocks[b2].d.length) inter.push(blocks[b2].d[di]);
      }
    }
    // interleave EC
    for (var ei = 0; ei < ecCW; ei++) {
      for (var b3 = 0; b3 < numBlocks; b3++) inter.push(blocks[b3].e[ei]);
    }

    // ---- Place data bits ----
    var bitIndex = 0;
    var upward = true;
    var col = size - 1;
    while (col > 0) {
      if (col === 6) col--;
      for (var rowIdx = 0; rowIdx < size; rowIdx++) {
        var row = upward ? size - 1 - rowIdx : rowIdx;
        for (var cc2 = 0; cc2 < 2; cc2++) {
          var ccol = col - cc2;
          if (ccol < 0) continue;
          if (!reserved[row][ccol]) {
            var bit = bitIndex < inter.length * 8 ? ((inter[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1) === 1 : false;
            bin[row][ccol] = bit;
            bitIndex++;
          }
        }
      }
      upward = !upward;
      col -= 2;
    }

    // ---- Choose best mask ----
    var bestMask = 0, bestScore = Infinity, bestMatrix = null;
    for (var mask = 0; mask < 8; mask++) {
      var tm = bin.map(function (r) { return r.slice(); });
      for (var mr = 0; mr < size; mr++) {
        for (var mc = 0; mc < size; mc++) {
          if (reserved[mr][mc]) continue;
          var inv = false;
          switch (mask) {
            case 0: inv = (mr + mc) % 2 === 0; break;
            case 1: inv = mr % 2 === 0; break;
            case 2: inv = mc % 3 === 0; break;
            case 3: inv = (mr + mc) % 3 === 0; break;
            case 4: inv = (Math.floor(mr / 2) + Math.floor(mc / 3)) % 2 === 0; break;
            case 5: inv = ((mr * mc) % 2) + ((mr * mc) % 3) === 0; break;
            case 6: inv = (((mr * mc) % 2) + ((mr * mc) % 3)) % 2 === 0; break;
            case 7: inv = (((mr + mc) % 2) + ((mr * mc) % 3)) % 2 === 0; break;
          }
          if (inv) tm[mr][mc] = !tm[mr][mc];
        }
      }
      // format info: EC level M = 00, mask bits
      var fmtBits = (0b00 << 3) | mask;
      var fmt = fmtBits << 10;
      var gen = 0x537;
      for (var gb = 14; gb >= 0; gb--) {
        if ((fmt >> gb) & 1) fmt ^= gen << gb;
      }
      fmt = (fmtBits << 10) | (fmt & 0x3ff);
      // place format info
      for (var fbi = 0; fbi < 15; fbi++) {
        var bitOn = ((fmt >> fbi) & 1) === 1;
        if (fbi < 6) {
          tm[fbi][8] = bitOn;
        } else if (fbi < 8) {
          tm[fbi + 1][8] = bitOn;
        } else {
          tm[size - 15 + fbi][8] = bitOn;
        }
        if (fbi < 8) {
          tm[8][size - fbi - 1] = bitOn;
        } else if (fbi < 9) {
          tm[8][15 - fbi - 1 + 1] = bitOn;
        } else {
          tm[8][15 - fbi - 1] = bitOn;
        }
      }
      tm[size - 8][8] = true; // dark module
      var sc = maskPenalty(tm);
      if (sc < bestScore) {
        bestScore = sc;
        bestMask = mask;
        bestMatrix = tm;
      }
    }

    return { matrix: bestMatrix, size: size, mask: bestMask };
  }

  function draw(canvas, matrix, size) {
    var scale = Math.floor(size / matrix.length) || 1;
    var px = matrix.length * scale;
    canvas.width = px;
    canvas.height = px;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#000';
    for (var r = 0; r < matrix.length; r++) {
      for (var c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) ctx.fillRect(c * scale, r * scale, scale, scale);
      }
    }
  }

  var QR = function () {};
  QR.prototype.make = function (text) {
    var bytes = unescape(encodeURIComponent(text));
    return makeQR(bytes);
  };
  QR.prototype.draw = draw;

  global.QRCode = QR;
})(this);
