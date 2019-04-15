import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import readline from 'readline';
let dirname: string = process.argv[2];
if (!dirname) {
  throw 'need a dirname';
}
let dirPath = path.join(__dirname, `../src/${dirname}`);
let originAppPath = path.join(__dirname, '../app.ts');
let originSpecPath = path.join(__dirname, '../app.spec.ts');
let targetPath = (filename: string) =>
  path.join(__dirname, `../src/${dirname}/${filename}`);

async function Start() {
  try {
    let isExist = await promisify(fs.readdir)(dirPath);
    if (isExist) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      await new Promise((resolve, reject) => {
        rl.question(
          `${dirname}已存在，是否确认替换? y/n\n`,
          (answer: string) => {
            if (answer.toLowerCase() === 'y') {
              resolve();
            } else {
              console.log('已取消');
              process.exit(0);
            }
          }
        );
      });
      rl.close();
    }
  } catch (e) {}
  fs.mkdir(dirPath, { recursive: true }, err => {
    if (err) throw err;
    Promise.all([
      promisify(fs.copyFile)(originAppPath, targetPath('app.ts'))
        .then(() => {
          fs.writeFile(originAppPath, '', err => {
            if (err) throw err;
          });
        })
        .catch(err => {
          throw err;
        }),
      promisify(fs.copyFile)(originSpecPath, targetPath('app.spec.ts'))
        .then(() => {
          fs.writeFile(originSpecPath, '', err => {
            if (err) throw err;
          });
        })
        .catch(err => {
          if (err) throw err;
        })
    ]).then(() => {
      console.log('已完成');
      process.exit(0);
    });
  });
}

Start();
