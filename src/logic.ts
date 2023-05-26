import { parseEpub } from '@gxl/epub-parser';
import { Epub } from '@gxl/epub-parser/lib/parseEpub';
import { convert } from 'html-to-text';
import { promises } from 'fs';
import { LANGUAGES } from './languages';
import { AudioSection } from './types/types';
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

export const fetchDataFromEpub = async (filePath: string): Promise<Array<AudioSection> | undefined>  => {
    let result: Array<AudioSection> | undefined;

    try {
        const epubObj: Epub = await parseEpub(filePath, {
            type: 'path',
        });

        const sections = epubObj?.sections;

        return sections
            ? sections.map(section => {
                const title: string = section.id ? section.id : randomAlphaNumeric(11);
                const content: string = section.htmlString ? convert(section.htmlString) : '';

                return {
                    title,
                    content,
                }
            })
            : undefined;
    } catch (err) {
        console.error('could not parse epub!');

        return result;
    }
}

export const createAudiobook = async ({ textData, bookName, language }: {
    textData: Array<AudioSection>;
    bookName: string;
    language: string;
}) => {
    try {
        const audiobookDir = `./audiobooks/${bookName}.${randomAlphaNumeric(13)}`;
        await promises.mkdir(audiobookDir);

        textData.map((section: AudioSection) => {
            const { title, content } = section;

            if (content) {
                const gtts = new gTTS(content, getKeyFromLanguageMap(language));
                const fileName: string = `${audiobookDir}/${title}.mp3`;

                gtts.save(fileName, function (err, result) {
                    if(err) {
                        console.error(err); 
                        throw new Error(err) 
                    }
                    console.log(`Success! created ${fileName}`);
                });
            }
        });
    } catch (err) {
        console.error('could not generate audiobook');
    }
}