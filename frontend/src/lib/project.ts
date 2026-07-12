export const FOV_H = 62; // approx phone camera horizontal FOV (deg)

export function angDiff(a: number, b: number): number {
  let x = a - b;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

// Project an object's (az, alt) onto a viewport of given size, relative to
// where the camera points (camAz, camAlt). Returns null if out of frame.
export function project(
  objAz: number, objAlt: number, camAz: number, camAlt: number,
  width: number, height: number, fovH = FOV_H,
): { x: number; y: number } | null {
  const fovV = fovH * (height / width);
  const dAz = angDiff(objAz, camAz);
  const dAlt = objAlt - camAlt;
  if (Math.abs(dAz) > fovH / 2 || Math.abs(dAlt) > fovV / 2) return null;
  const x = width / 2 + (dAz / (fovH / 2)) * (width / 2);
  const y = height / 2 - (dAlt / (fovV / 2)) * (height / 2);
  return { x, y };
}
