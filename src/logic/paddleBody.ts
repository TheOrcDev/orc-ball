/**
 * Phaser Arcade Body.setSize(width, height) treats width/height as *source*
 * (unscaled) pixels and multiplies by the Game Object's scaleX/Y for the
 * world body size (Body.js ~1501). Passing displayWidth double-applies scale.
 */

/** Args to pass to body.setSize so world size matches the scaled sprite. */
export function paddleBodySetSizeArgs(
  frameWidth: number,
  frameHeight: number,
): { width: number; height: number } {
  return { width: frameWidth, height: frameHeight };
}

/** World body size after Phaser applies scale to source setSize args. */
export function paddleBodyWorldSize(
  sourceWidth: number,
  sourceHeight: number,
  scaleX: number,
  scaleY: number,
): { width: number; height: number } {
  return {
    width: sourceWidth * Math.abs(scaleX),
    height: sourceHeight * Math.abs(scaleY),
  };
}

/**
 * Asserts the correct setSize path: body world size equals visual display size
 * for the three paddle scales (shrink / normal / expand).
 */
export function paddleBodyMatchesDisplay(
  frameWidth: number,
  frameHeight: number,
  scale: number,
): { bodyWidth: number; bodyHeight: number; displayWidth: number; displayHeight: number; match: boolean } {
  const { width: srcW, height: srcH } = paddleBodySetSizeArgs(frameWidth, frameHeight);
  const body = paddleBodyWorldSize(srcW, srcH, scale, scale);
  const displayWidth = frameWidth * Math.abs(scale);
  const displayHeight = frameHeight * Math.abs(scale);
  return {
    bodyWidth: body.width,
    bodyHeight: body.height,
    displayWidth,
    displayHeight,
    match:
      Math.abs(body.width - displayWidth) < 1e-9 &&
      Math.abs(body.height - displayHeight) < 1e-9,
  };
}
