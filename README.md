# multi-compression-tool

Please make sure the following packages are installed:
npm install sharp
npm install tinify
npm install googleapis
npm i --save detect-file-type
npm install @ffmpeg/ffmpeg @ffmpeg/core
npm install fs-extra

Update the below values to choose between a blog or build
const updateBlog = { date: blogDate, title: 'enter blog title', blog: change to true if you are compressing a blog };
const updateBuild = { id: 'add google drive id', build: change to false if you are compressing a blog };
