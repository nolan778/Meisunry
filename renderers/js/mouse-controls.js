// Listen for the wheel event to adjust the CSS property
imageGrid.addEventListener('wheel', event => {
  processWheel(event);
});
gridWrapper.addEventListener('wheel', event => {
  processWheel(event);
});

function processWheel(event) {
  if (event.ctrlKey) {
    event.preventDefault();
    // Determine the direction of the scroll
    handleZoom(event.deltaY > 0 ? -1 : 1);
  }
  else if (event.shiftKey)
  {
    // Determine the direction of the scroll
    handlePadding(event.deltaY > 0 ? -1 : 1);
  }
  else if (event.altKey) {
    event.preventDefault();
    // Adjust auto-scroll speed
    handleAutoScrollSpeed(event.deltaY > 0 ? 1 : -1);
  }
}

// Add middle mouse button listener to stop auto-scroll
document.addEventListener('mousedown', (event) => {
  if (event.button === 1) { // button 1 is middle mouse button
    event.preventDefault();
    stopAutoScroll();
  }
});