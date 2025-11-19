// client/utils/caretUtils.ts

// We need to get the computed style of the textarea, so we need a list of properties to copy.
const properties = [
  'boxSizing',
  'width', 
  'height',
  'overflowX',
  'overflowY', 

  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',

  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',

  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',

  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',

  'letterSpacing',
  'wordSpacing',

  'tabSize',
  // 'MozTabSize' is not a standard property and causes issues
];

const isBrowser = typeof window !== 'undefined';

let div: HTMLDivElement | null = null;
let span: HTMLSpanElement | null = null;

export function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
  if (!isBrowser) {
    throw new Error('getCaretCoordinates should only be called in a browser environment.');
  }

  // The div has to be created only once per page
  if (!div) {
    div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.overflow = 'hidden'; 
    document.body.appendChild(div);

    span = document.createElement('span');
    span.textContent = '.'; // The span needs a character to have a size
    div.appendChild(span);
  }

  // Copy the textarea styles to the div
  const style = window.getComputedStyle(element);
  
  // Copying styles safely
  properties.forEach(prop => {
    // Using setProperty is safer than direct assignment
    div!.style.setProperty(prop, style.getPropertyValue(prop));
  });

  // Set the div's content to the text inside the textarea up to the caret position
  div.textContent = element.value.substring(0, position);
  
  // Appending the span to the end of the content
  div.appendChild(span!);

  // Get the coordinates of the span
  const borderTop = parseInt(style.getPropertyValue('borderTopWidth')) || 0;
  const borderLeft = parseInt(style.getPropertyValue('borderLeftWidth')) || 0;

  const coordinates = {
    top: span!.offsetTop + borderTop,
    left: span!.offsetLeft + borderLeft,
    height: span!.offsetHeight
  };

  return coordinates;
}
