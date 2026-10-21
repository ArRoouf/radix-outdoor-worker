// QR core only: avoid Node filesystem and canvas dependencies in Workers.
import QR from "qrcode/lib/core/qrcode";
export default {
  async toString(text: string, _options?: any) {
    const q = QR.create(text, { errorCorrectionLevel: "M" }),
      n = q.modules.size;
    let path = "";
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (q.modules.get(y, x)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" role="img" aria-label="Kode QR"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#173f2d"/></svg>`;
  },
};
