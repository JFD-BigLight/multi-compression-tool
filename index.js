
const fs = require('fs-extra');
const sharp = require('sharp');
const tinify = require('tinify');
const { google } = require('googleapis');
const detect = require('detect-file-type');
const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');

const maxCompressFileSize = 150;

tinify.key = '6R4Qx0ZRXSCSK4j5d0q7xwsk5YWhYWcZ';

const today = new Date();
const dd = String(today.getDate()).padStart(2, '0');
const mm = String(today.getMonth() + 1).padStart(2, '0');
const yyyy = today.getFullYear();
const blogDate = mm + dd + yyyy;

// update compression details
const updateBlog = { date: blogDate, title: 'womesn jackets forever', blog: true };
const updateBuild = { id: '1hzOPjrGwqn-qOFUSl2S-WqFz2YtW_Ytu', build: false };

// formated image conversion
const processImage = async (drive, assets) => {
  try {
    if (updateBuild.build) {
      const { id, name } = assets;
      // download image from google drive as buffer
      const downloadedImage = await drive.files.get(
        { fileId: id, alt: 'media' },
        { responseType: 'arraybuffer' },
      );
        // convert images to base 64
      const imageBuffer = Buffer.from(downloadedImage.data, 'base64');
      // create images locally
      detect.fromBuffer(imageBuffer, (err, type) => {
        if (type.ext === 'jpg') {
          fs.writeFileSync(`./images/${name}`, imageBuffer);
        }
      });
    }
    const imgs = fs.readdirSync('./images').filter((file) => file.endsWith('.jpg'));
    // recurrsion of files
    const recursion = () => {
      async function tinifyImages() {
        const promises = imgs.map(async (image) => {
          const source = tinify.fromFile(`./images/${image}`);
          await source.toFile(`./images/${image}`);
        });
        await Promise.all(promises);
      }
      tinifyImages().then(() => {
        const newLocal = console.log;
        const log = newLocal;
        imgs.forEach((image) => {
          const fileSizeKB = fs.statSync(`./images/${image}`).size / 1000;
          if (updateBlog.blog && fileSizeKB <= maxCompressFileSize) {
            const nameSlug = drive.title.replaceAll(' ', '-');
            const moveFiles = (formatedFile) => {
              fs.move(`./images/${image}`, formatedFile, (err) => (err ? console.log(err) : console.log(`\x1b[32m${image} successfully moved!! \x1b[0m`)));
            };
            const containsNumbers = (str) => /\d/.test(str);
            if (containsNumbers(image)) {
              const findindex = (str) => { const nums = str.match(/\d/); return str.indexOf(nums); };
              const numType = image.slice(findindex(image), image.length);
              const formatedFileName = `${nameSlug}_${drive.date}_${numType}`;
              moveFiles(`./final/${formatedFileName.toLowerCase()}`);
            } else {
              moveFiles(`./final/${nameSlug}_${drive.date}_Hero.jpg`.toLowerCase());
            }
          }
          if (fileSizeKB > maxCompressFileSize) {
            recursion();
          }
        });
      });
    };
    recursion();
    // convert files to avif and webp format
    if (updateBuild.build) {
      imgs.forEach((file) => {
        const formattedName = file.replace('.jpg', '');
        sharp(`./images/${file}`).toBuffer().then((value) => {
          sharp(value).toFile(`./images/${formattedName}.avif`);
          sharp(value).toFile(`./images/${formattedName}.webp`);
        }).catch(function(err) {
            console.log("Error occured ", err);
          });
      });
    }
  } catch (err) {
    const { log } = console;
    log('Error: ', err.message);
  }
};

const processVideo = async (drive, file) => {
  try {
    const ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();
    const { id, name } = file;
    const formattedName = name.replace('.mp4', '').replace('.gif', '');
    const extension = name.includes('.mp4') ? '.mp4' : '.gif';

    // download video from google drive as buffer
    const downloadedVideo = await drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    const videoBuffer = Buffer.from(downloadedVideo.data);

    ffmpeg.FS('writeFile', `tmp${extension}`, await fetchFile(videoBuffer));
    await ffmpeg.run(
      '-i',
      `tmp${extension}`,
      '-b:v',
      '0',
      '-crf',
      '25',
      '-f',
      'mp4',
      '-vcodec',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      'tmp.mp4',
    );
    let length = ffmpeg.FS('readFile', 'tmp.mp4').length / 1_048_576; // size in MB

    if (length > 0.15) {
      // 150KB
      let compression = 25;
      while (length > 0.15) {
        await ffmpeg.run(
          '-i',
          `tmp${extension}`,
          '-b:v',
          '0',
          '-crf',
          `${compression}`,
          '-f',
          'mp4',
          '-vcodec',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          'tmp.mp4',
        );
        length = ffmpeg.FS('readFile', 'tmp.mp4').length / 1_048_576; // size in MB

        compression += 1;
      }
    }

    await fs.promises.writeFile(
      `./videos/${formattedName}.mp4`,
      ffmpeg.FS('readFile', 'tmp.mp4'),
    );
  } catch (err) {
    console.log('Error: ', err.message);
  }
};

const arrayOfPromises = [];
const getFilesFromFolders = async (drive, parentFolderID) => {
  try {
    const result = await drive.files.list({
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      q: `'${parentFolderID}' in parents and trashed = false`,
    });

    for await (const file of result.data.files) {
      const { id, name, mimeType } = file;

      // more folders
      if (mimeType.includes('google-apps.folder')) {
        const childFolderID = id;
        await getFilesFromFolders(drive, childFolderID);
      } else if (name.includes('jpg')) {
        // images
        arrayOfPromises.push(
          new Promise((resolve) => resolve(processImage(drive, file))),
        );
      } else if (name.includes('gif') || name.includes('mp4')) {
        // videos
        arrayOfPromises.push(
          new Promise((resolve) => resolve(processVideo(drive, file))),
        );
      }
    }
  } catch (err) {
    console.log('Error: ', err.message);
  }
};
async function main(args) {
  try {
    const folderID = args.id;
    if (!folderID) {
      processImage(args, null);
    } else {
      const auth = new google.auth.GoogleAuth({
        keyFile: './BL.json',
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      const drive = google.drive({
        version: 'v3',
        auth,
      });
        // get the files
      await getFilesFromFolders(drive, folderID);
    }
    await Promise.all(arrayOfPromises);
  } catch (err) {
    console.log('Error: ', err.message);
  }
}
if (updateBlog.blog) { main(updateBlog); } else if (updateBuild.build) { main(updateBuild); }


