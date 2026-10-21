declare module "qrcode/lib/core/qrcode" {
  const QR: {
    create(
      text: string,
      options?: any,
    ): { modules: { size: number; get(x: number, y: number): number } };
  };
  export default QR;
}
