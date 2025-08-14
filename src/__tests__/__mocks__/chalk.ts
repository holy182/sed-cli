// Mock chalk for Jest testing
const chalk = {
  blue: (text: string) => text,
  green: (text: string) => text,
  red: (text: string) => text,
  yellow: (text: string) => text,
  cyan: (text: string) => text,
  magenta: (text: string) => text,
  white: (text: string) => text,
  gray: (text: string) => text,
  bold: (text: string) => text,
  dim: (text: string) => text,
  italic: (text: string) => text,
  underline: (text: string) => text,
  strikethrough: (text: string) => text,
  reset: (text: string) => text,
  // Add any other chalk methods you use
};

export default chalk;
