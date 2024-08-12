const ipcRend = window.ipcRenderer;
const imageGrid = document.getElementById('imageGrid');
const focusImg = document.getElementById('img-focus');
const focusVideo = document.getElementById('video-focus');
const focusImgVideoWrapper = document.getElementById('img-focus-wrapper');
const muteButtonFocus = document.getElementById('mute-button-focus');
const zoomPanHolder = document.getElementById('zoomPanHolder');
const backButton = document.getElementById('back-button-focus');
const resetFocusImgButton = document.getElementById('reset-button-focus');
let panZoomInstance = panzoom(zoomPanHolder);
panZoomInstance.dispose();

// Set up preferences data
let preferencesData;
function updatePreferencesData(callback) {
  /* Request our data */
  ipcRend.invoke('loadAppData').then(data => { preferencesData = data; callback(); });
}
updatePreferencesData(setupImagesInGrid);

currentZoom = 1;
currentPadding = .98;

// Initialization
let grid;
let resortAfterImageLoad;
function setupImagesInGrid() {
  ipcRend.invoke('readFilesFromDisk', preferencesData.folderLocation).then(files => {
    console.log(`${preferencesData.folderLocation}`);
  
    resortAfterImageLoad = false;
  
    grid = new Masonry('.grid', {
      itemSelector: '.grid-item',
      gutter: 0,
    });
  
    files = resort(files);
    handle_resort(files);
    loadImages(files);
  
    window.electronAPI.onSortUpdate((event, value) => {
      console.log('sort update');
      updatePreferencesData(() => { 
        files = resort(files);
        handle_resort(files);
        resortAfterImageLoad = true;
      });
    })
  
    window.electronAPI.onFileDeleted((event, deletedFilePath) => {
      /* Fix file path */
      deletedFilePath = deletedFilePath.replace(/\//g, '\\');
      /* Reduce files list */
      files = files.filter(file => file.fullPath !== deletedFilePath);
      /* Update image count on topbar */
      imgCountEl = document.getElementById(`header-image-count`);
      imgCountEl.innerHTML = `${files.length} Images`;
      /* Play image deletion animation and remove it from grid */
      let deletedFile = document.getElementById(deletedFilePath);
      if (deletedFile.tagName === "SOURCE") deletedFile = deletedFile.parentNode
      deletedFile.classList.add(`hide`);
      new Promise((resolve) => setTimeout(() => { 
        imageGrid.removeChild(deletedFile.parentNode); 
        grid.reloadItems();
        grid.layout();
      }, 500));
    })

    window.electronAPI.onFileAdded((event, newFile) => {
      /* Add to files list */
      files.push(newFile);
      /* Update image count on topbar */
      imgCountEl = document.getElementById(`header-image-count`);
      imgCountEl.innerHTML = `${files.length} Images`;
      /* Append */
      addImage(newFile);
      /* Resort */
      files = resort(files);
      handle_resort(files);
    })

    function _addImage(file) {
      // Only generate a new element and append it if it doesn't already exist
      const existingEl = document.getElementById(`${file.fullPath}`);
      if (existingEl != null) return;

      // Create div element
      const gridItem = document.createElement('div');
      gridItem.className = 'grid-item';

      let imgElement;
      const imgPath = file.fullPath;
      //console.log(file.isImage);
      if (file.isImage === true)
      {
        // Create img element
        imgElement = document.createElement('img');
        //imgElement.loading = "lazy";
        imgElement.src = imgPath;
        imgElement.id = imgPath;
        imgElement.className = "grid-image";

        // Add full screen click event
        imgElement.addEventListener('click', () => {
          if (focusImgVideoWrapper.classList.contains('show')) 
          {
            focusImgVideoWrapper.classList.remove('show');
            return;
          }
          // You can perform operations on the clickedImage here
          focusImgVideoWrapper.classList.add('show');
          focusImg.src = imgPath;
          focusImg.classList.add('show')
          backButton.classList.remove('hide');
          resetFocusImgButton.classList.remove('hide');

          panZoomInstance = panzoom(zoomPanHolder);
          resetPanZoom(focusImg.naturalWidth, focusImg.naturalHeight);
        });
      }
      else
      {
        imgElement = document.createElement('video');
        imgElement.autoplay = true;
        imgElement.muted = true;
        imgElement.loop = true;
        imgElement.className = "grid-image";
        const sourceElement = document.createElement(`source`);
        sourceElement.src = imgPath;
        sourceElement.id = imgPath;
        imgElement.appendChild(sourceElement);
        const audioA = document.createElement(`a`);
        audioA.classList.add(`audio-button`);
        audioA.classList.add(`overlay-circle-button`);
        gridItem.appendChild(audioA);
        
        // Mute function
        audioA.addEventListener('click', () => {
          if (focusImgVideoWrapper.classList.contains('show')) return;
          imgElement.muted = !imgElement.muted;
          if (imgElement.muted) audioA.classList.remove(`unmute`);
          else audioA.classList.add(`unmute`);
        });

        // Add full screen click event
        imgElement.addEventListener('click', () => {
          if (focusImgVideoWrapper.classList.contains('show')) 
          {
            focusImgVideoWrapper.classList.remove('show');
            return;
          }
          // Clear all img settings
          focusImg.src = '';
          zoomPanHolder.style.transformOrigin = `0px 0px 0px`;
          zoomPanHolder.style.transform = `inherit`;

          let zooming = document.body.style.zoom = 1;

          // You can perform operations on the clickedImage here
          focusImgVideoWrapper.classList.add('show');
          focusVideo.querySelector('source').src = imgPath;
          focusVideo.load();
          muteButtonFocus.classList.remove(`hide`);
          backButton.classList.remove('hide');
          // Sync settings
          focusVideo.currentTime = imgElement.currentTime;
          focusVideo.muted = imgElement.muted;
          if (focusVideo.muted) muteButtonFocus.classList.remove(`unmute`);
          else muteButtonFocus.classList.add(`unmute`);
          // Pause original because focus is playing
          imgElement.muted = true;
          imgElement.pause();
          audioA.classList.remove(`unmute`);
        });
      }
      

      // Nest within div
      gridItem.appendChild(imgElement);

      // Add to grid
      imageGrid.appendChild(gridItem);
      return gridItem;
    }

    function addImage(file) {
      const gridItem = _addImage(file);
      if (gridItem == undefined) return;
      grid.appended(gridItem);
      grid.reloadItems();
      grid.layout();
    }
  
    // Lazy loads images. Does so with a bit of a delays
    async function loadImages(input_files) {
      const cached_files = [...input_files];
  
      noItemsEl = document.getElementById(`no-items-text`);
      imgCountEl = document.getElementById(`header-image-count`);
      imgCountEl.innerHTML = `${files.length} Images`;
      headerPathEl = document.getElementById(`header-folder-path`);
      headerPathEl.innerHTML = preferencesData.folderLocation;
      if (cached_files.length == 0)
      {
        noItemsEl.classList.add("show");
        pathEl = document.getElementById(`folder-path`);
        pathEl.innerHTML = preferencesData.folderLocation;
        return;
      }
      noItemsEl.classList.remove("show");

      let iter = 0;
      let lastProcessTime = Date.now();
      let batchItems = [];

      const processBatch = async () => {
        let currentBatch = batchItems;
        batchItems = [];

        // Wait for all images in the batch to load
        const onloadPromises = [];
        for (const gridItem of currentBatch) {
          const imgElement = gridItem.querySelector('img, video');
          if (imgElement == null || imgElement.complete) continue;
          onloadPromises.push(new Promise(resolve => {
            imgElement.onload = resolve;
            imgElement.onerror = resolve;
            if (imgElement.complete) resolve();
            setTimeout(resolve, 5000);
          }));
        }
        await Promise.all(onloadPromises);

        // Wait for the batch to be processed (with a timeout)
        await new Promise(resolve => {
          grid.once('layoutComplete', resolve);

          // Add the batch to the grid
          grid.addItems(currentBatch);
          grid.layout();

          setTimeout(resolve, 5000);
        });

        // Show the images
        for (const gridItem of currentBatch)
          gridItem.style.visibility = 'visible';
      };

      const initialBatchSize = 30;
      const processUpdateDelay = 1000 / 5;
      let batchSize = initialBatchSize;

      console.time('loadImages');
      for (const file of cached_files) {
        const gridItem = _addImage(file);
        if (gridItem == undefined) continue;
        gridItem.style.visibility = 'hidden';
        batchItems.push(gridItem);
        
        iter++;
        if (iter >= batchSize || Date.now() - lastProcessTime > processUpdateDelay) {
          batchSize = Math.max(batchItems.length * 4, initialBatchSize);
          await processBatch();
          lastProcessTime = Date.now();
          iter = 0;
        }
      }
      await processBatch();

      grid.reloadItems();
      grid.layout();
      console.timeEnd('loadImages');

      // Show done pop up
      const popUp = document.getElementById(`done-pop-up`);
      popUp.classList.add('show');
  
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      for (const file of cached_files) {
        // Only generate a new element and append it if it doesn't already exist
        const existingEl = document.getElementById(`${file.name}`);
        if (existingEl != null) existingEl.classList.add("shown");
      }
  
      if (resortAfterImageLoad) handle_resort(files);
      resortAfterImageLoad = false;
    }
  
    // Listen for the wheel event to adjust the CSS property
    imageGrid.addEventListener('wheel', event => {
      if (event.ctrlKey) {
        event.preventDefault();
  
        // Determine the direction of the scroll
        const zoomAmount = event.deltaY > 0 ? 0.75 : 1.25;
        currentZoom *= zoomAmount;
        currentZoom = Math.max(currentZoom, 0.1);
        update_images();  
        // Trigger Masonry Layout's layout after changing the CSS property
        grid.layout();    
      }
      else if (event.shiftKey)
      {
        // Determine the direction of the scroll
        const paddingAmount = event.deltaY > 0 ? 0.1 : -0.1;
        currentPadding += paddingAmount;
        currentPadding = Math.max(Math.min(currentPadding, 1), 0.25);
        update_images();
        // Trigger Masonry Layout's layout after changing the CSS property
        grid.layout();
      }
    });
  
    setTimeout(() => { update_images(); grid.layout(); }, 100);
  
    window.addEventListener('resize', function(event) {
        update_images();
        if (is_an_image_focused()) resetPanZoom(focusImg.naturalWidth, focusImg.naturalHeight);
        // Trigger Masonry Layout's layout after changing the CSS property
        grid.layout();
    }, true);
  
  }).catch(err => {
    console.error('Error reading image folder:', err);
  });
}

/* Sorting and updating */

function update_images() {
  const gridItems = document.querySelectorAll('.grid-image');
  // Get new width
  width = calc_width();
  gridItems.forEach(item => {
    item.style.maxWidth = `${width}px`;
    item.style.minWidth = `${width}px`;
    item.style.transform = `scale(${currentPadding})`;
    // You can adjust other styling properties as needed
  });
  imageGrid.style.transform = `scale(${get_transform_correction_scale()})`;
  imageGrid.style.marginTop = `${(1-currentPadding)*width}px`;
}

function calc_width() {
  originalWidth = (500 * currentZoom);
  return originalWidth;
}

function get_transform_correction_scale() {
  originalWidth = (500 * currentZoom);
  itemsCount = Math.floor((document.body.clientWidth / originalWidth));
  actualPresentedWidth = originalWidth * itemsCount;
  transformScale = (document.body.clientWidth / actualPresentedWidth);
  return transformScale;
}

function resort(files) {
  switch (preferencesData.sortMode) {
    case 'newest':
      console.log(`sorting by newest`);
      files = files.sort((a, b) => b.date - a.date); break;
    case 'oldest':
      console.log(`sorting by oldest`);
      files = files.sort((a, b) => b.date - a.date); 
      files = files.reverse(); break;
    case 'name-a':
      console.log(`sorting by name a to z`);
      files = files.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name-z':
      console.log(`sorting by name z to a`);
      files = files.sort((a, b) => a.name.localeCompare(b.name));
      files = files.reverse(); break;
    case 'type-a':
      console.log(`sorting by type a to z`);
      files = files.sort(sortByExtension); break;
    case 'type-z':
      console.log(`sorting by type z to a`);
      files = files.sort(sortByExtension);
      files = files.reverse(); break;
    case 'random':
      console.log(`sorting randomly`);
      for (let i = files.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [files[i], files[j]] = [files[j], files[i]];
      }
      break;
  }
  return files;
}

// Custom sorting function to sort by file extension
function sortByExtension(a, b) {
  const extA = a.name.split('.').pop().toLowerCase(); // Get the extension of file A
  const extB = b.name.split('.').pop().toLowerCase(); // Get the extension of file B

  if (extA < extB) {
    return -1; // A should come before B
  }
  if (extA > extB) {
    return 1; // A should come after B
  }
  return 0; // A and B are of the same type
}

function handle_resort(cached_files) {
  cached_files.reverse().forEach(file => {
    const imgElement = document.getElementById(`${file.fullPath}`);
    if (imgElement == null) return;
    const divElement = imgElement.parentElement;
    const parentElement = divElement.parentElement;
    parentElement.insertBefore(divElement, parentElement.firstChild);
  });
  cached_files.reverse();
  grid.reloadItems();
  grid.layout();
}

function is_an_image_focused() {
  return focusImg.classList.contains('show');
}

