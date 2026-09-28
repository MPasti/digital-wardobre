import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

export async function preparePhoto(uri: string) {
  const context = ImageManipulator.manipulate(uri);
  let rendered: ImageRef | undefined;
  try {
    rendered = await context.renderAsync();
    if (Math.max(rendered.width, rendered.height) > 1024) {
      context.resize(rendered.width >= rendered.height ? { width: 1024 } : { height: 1024 });
      const resized = await context.renderAsync();
      rendered.release();
      rendered = resized;
    }
    return await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  } finally {
    rendered?.release();
    context.release();
  }
}
