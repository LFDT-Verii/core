export const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    // eslint-disable-next-line no-undef
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    // eslint-disable-next-line better-mutation/no-mutation
    reader.onload = () => resolve(reader.result);
    // eslint-disable-next-line better-mutation/no-mutation
    reader.onerror = reject;
  });

export const ERRORS = {
  minSize: 'PNG/JPG Logo is smaller than 300X300. Please select another file.',
  maxSize: 'PNG/JPG/SVG Logo is bigger than 400X400. Please select another file.',
  shape: `Image Does Not Meet Requirements. Please upload a different image.\n
      Image height and width must be equal. Minimum 300×300, Maximum 400×400. Up to 500 kb.`,
  svgSize: '.SVG logo must be between 300x300 & 400x400.  Please select another file.',
  weight: 'Logo file size is more than 500KB. Please select another file',
  format: 'File format is not supported. Please select a png, jpg or svg file.',
  failed: `There was an error processing the selected image.\n
      Please review the image requirements and try again.`,
  default: 'Please try again',
};

export const IMAGE_STATUS_REFETCH_INTERVAL = 5000;
