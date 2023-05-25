import { parseEpub } from '@gxl/epub-parser';
import { Epub } from '@gxl/epub-parser/lib/parseEpub';
import { convert } from 'html-to-text';
import { promises } from 'fs';
import { LANGUAGES } from './languages';
const gTTS = require('gtts');


const getCapitalCase = (str: string) => {
    const arr = str.split('');

    for (let i = 0; i < arr.length; i++) {
        arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
    }

    return arr.join();
}

const inverse = (obj:Object ) => {
    let retobj = {};
    for(let key in obj){
      retobj[obj[key]] = key;
    }
    return retobj;
}

const getKeyFromLanguageMap = (input: string) => {
    const inverseLanguageMap = inverse(LANGUAGES);
    return inverseLanguageMap[getCapitalCase(input)];
} 

const randomAlphaNumeric = (length: number) => {
    let s = '';
    Array.from({ length }).some(() => {
      s += Math.random().toString(36).slice(2);
      return s.length >= length;
    });
    return s.slice(0, length);
};

export const fetchDataFromEpub = async (filePath: string): Promise<Array<string | undefined> | undefined>  => {
    let result: Array<string | undefined> | undefined;

    try {
        const epubObj: Epub = await parseEpub(filePath, {
            type: 'path',
        });

        const sections = epubObj?.sections;

        const textPerSection: Array<string | undefined> | undefined = sections 
            ? sections.map(section => {
                const htmlString: string | undefined = section.htmlString;

                if (htmlString) {
                  return convert(htmlString);
                }
            }) 
            : undefined;
        
        result = textPerSection;

        return result;
    } catch (err) {
        console.error('could not parse epub!');

        return result;
    }
}

export const writeTextDataToFile = async ({ textData, bookName }: {
    textData: Array<string | undefined>;
    bookName: string;
}): Promise<string | null> => {
    const hasAllStrings: boolean = textData.every(item => typeof(item) === 'string');

    let textBlob: string;
    let textFilePath: string;

    if (hasAllStrings) {
        textBlob = textData.reduce((acc: string, curr: string | undefined) => {
            if (!curr) {
                curr = '';
            }

            acc += curr + '\n';
            return acc;
        }, '' as string);

        if (textBlob) {
            const randomStr = `${bookName}.${randomAlphaNumeric(13)}`;
            textFilePath = `./textfiles/${randomStr}.txt`;
            await promises.writeFile(textFilePath, textBlob);

            return textFilePath;
        }
        return null;
    }

    return null;
}

export const createAudiobook = async ({ textFilePath, language }: {
    textFilePath: string;
    language: string;
}) => {
    let dataToRead: string;

    try {
        dataToRead = await promises.readFile(textFilePath, 'utf8');

        const gtts = new gTTS(dataToRead, getKeyFromLanguageMap(language));
        const textFilePathArr = textFilePath.split('/');
        const audioFileName = textFilePathArr[textFilePathArr.length - 1].replace('.txt', '');

        gtts.save(`./audiobooks/${audioFileName}.mp3`, function (err, result) {
            if(err) { throw new Error(err) }
            console.log('Success! File created in audiobooks folder');
        });
    } catch (err) {
        console.error('could not generate audiobook');
    }
}