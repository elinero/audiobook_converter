import { parseEpub } from '@gxl/epub-parser';
import { Epub } from '@gxl/epub-parser/lib/parseEpub';
import { convert } from 'html-to-text';
import { promises } from 'fs';
import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech"
import { 
    AudioSection,
    UserInputData,
 } from './types/types';
import {
    getKeyFromLanguageMap,
    randomAlphaNumeric,
} from './helpers/helpers';

export const fetchUserInput = (): UserInputData => {
    const filePath: string = process.argv[2];
    const language: string = process.argv[3] || 'english';

    if (!filePath) {
        throw new Error('Filepath must be defined');
    }

    return {
        filePath,
        language,
    }
}

export const getBookNameFromFilePath = (filePath: string): string => {
    const filePathArr: string[] = filePath.split('/');
    return filePathArr[filePathArr.length - 1];
}

export const fetchDataFromEpub = async (filePath: string): Promise<Array<AudioSection> | Error>  => {
    try {
        const epubObj: Epub = await parseEpub(filePath, {
            type: 'path',
        });

        const sections = epubObj!.sections;

        if (!sections) {
            throw new Error('Could not get sections from file...');
        }

        else if (Array.isArray(sections) && sections.length < 1) {
            throw new Error ('File content is empty');
        }

        return sections.map(section => {
            const title: string = section.id ? section.id : randomAlphaNumeric(11);
            const content: string = section.htmlString ? convert(section.htmlString) : '';

            return {
                title,
                content,
            }
        }) as Array<AudioSection>;
    } catch (err) {
        console.error('could not parse epub!');
        throw err;
    }
}

export const convertTextToAudio = async ({ textData, bookName, language }: {
    textData: Array<AudioSection>;
    bookName: string;
    language: string;
}) => {
    try {
        const audiobookDir = `./audiobooks/${bookName}.${randomAlphaNumeric(13)}`;
        await promises.mkdir(audiobookDir);
        const ttsClient = new TextToSpeechClient();

        textData.map(async (section: AudioSection) => {
            const { title, content } = section;

            if (content) {
                const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
                    input: { text: content },
                    voice: { 
                        languageCode: getKeyFromLanguageMap(language), 
                        ssmlGender: 'NEUTRAL',
                    },
                    audioConfig: {
                        audioEncoding: `MP3`,
                        pitch: 0.00,
                        speakingRate: 1.00
                    },
                }

                const [response] = await ttsClient.synthesizeSpeech(request);
                const fileName: string = `${audiobookDir}/${title}.mp3`;

                if (response && response.audioContent) {
                    promises.writeFile(fileName, response.audioContent, 'binary');
                    console.log(`Audio content written to file: ${fileName}`);
                } 
            }
        });
    } catch (err) {
        console.error('could not generate audiobook');
    }
}

export const createAudiobook = async () => {
    try {
        const { filePath, language } = fetchUserInput();

        const bookName = getBookNameFromFilePath(filePath);

        const textData = await fetchDataFromEpub(filePath) as Array<AudioSection>;

        await convertTextToAudio({ textData, bookName, language });
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}