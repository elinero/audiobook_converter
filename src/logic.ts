import { parseEpub } from '@gxl/epub-parser';
import { Epub } from '@gxl/epub-parser/lib/parseEpub';
import { convert } from 'html-to-text';
import { promises } from 'fs';
import { voices } from './helpers/voices';
import ffmpeg from 'fluent-ffmpeg';
import * as axios from 'axios';
import * as wav from 'node-wav';
import { MAX_CHUNK_SIZE } from './helpers/constants';
import { 
    AudioSection,
    UserInputData,
 } from './types/types';
import {
    randomAlphaNumeric,
} from './helpers/helpers';
import { constrainedMemory } from 'process';


 const fetchUserInput = (): UserInputData => {
    const filePath: string = process.argv[2];
    const voice: string = process.argv[3] || 'random';

    if (!voices.includes(voice)) {
        throw new Error('Bad voice selection...');
    }

    if (!filePath) {
        throw new Error('Filepath must be defined');
    }

    return {
        filePath,
        voice,
    }
}

const getBookNameFromFilePath = (filePath: string): string => {
    const filePathArr: string[] = filePath.split('/');
    return filePathArr[filePathArr.length - 1];
}

const fetchDataFromEpub = async (filePath: string): Promise<Array<AudioSection> | Error>  => {
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

        return sections.map((section, idx) => {
            const content: string = section.htmlString ? convert(section.htmlString) : '';
            const sectionLines = content.split('\n');
            const firstWordOfSection = sectionLines[0];
            const title: string = firstWordOfSection ? firstWordOfSection : randomAlphaNumeric(11);

            return {
                idx,
                title,
                content,
            }
        }) as Array<AudioSection>;
    } catch (err) {
        console.error('could not parse epub!');
        throw err;
    }
}

const chunkTextData = (textData: AudioSection[]): AudioSection[] => {
    const textDataChunks: AudioSection[] = [];

    textData.forEach((section: AudioSection) => {
        let subsection: number = 0;
        const { title, content } = section;
        const chunkSize: number = MAX_CHUNK_SIZE;

        if (!content) {
            return null;
        }

        if (content && content.length < chunkSize) {
            textDataChunks.push(section);
            return null;
        }

        let remainingContent: string = content;

        while (remainingContent.length > 0) {
            subsection++;
            const chunkEnd = chunkSize > remainingContent.length ? remainingContent.length : chunkSize;
            const chunk = remainingContent.slice(0, chunkEnd);

            const newSection = {
                title: `${title}-${subsection}`,
                content: chunk,
                idx: -1,
            };

            textDataChunks.push(newSection);
            
            remainingContent = remainingContent.substring(chunkEnd, remainingContent.length);
        }

        return null;
    });
    // remap the indexes
    textDataChunks.forEach((section, idx) => {
        section.idx = idx;
        section.title = `${idx}_${section.title}`;
    });

    return textDataChunks;
}

const callAudioServerWithText = async ({voice, content}) => {
    return axios.post(
        'http://localhost:8000/fetch_audio_data/', {
            voice,
            text: content,
        });
}

const createAudioFilePromise = ({section, audiobookDir, voice}: {
    section: AudioSection; 
    audiobookDir: string;
    voice: string;
}): Function => {
    return () => new Promise((resolve, reject) => {
        try {
            // title can be the title of the chapter or appendix etc...
            const { title, content } = section;

            if (!content) throw new Error('Content not available for section...');

            console.log(`GENERATING AUDIO FOR SECTION: ${title}`);
            const fileName: string = `${audiobookDir}/${title}.wav`;

            callAudioServerWithText({voice, content})
            .then((resp) => {
                const { audio_data:audioDataStr } = resp?.data;

                if (!audioDataStr) {
                    throw new Error('Error parsing audio data from audio server...');
                }

                const audioData = [ JSON.parse(JSON.parse(audioDataStr)) ];
                
                const encoded = wav.encode(audioData, {
                    sampleRate: 24000,
                    float: true,
                    bitDepth: 32,
                    channels: 1,
                });

                if (!encoded) {
                    throw new Error('Error encoding audio data...')
                }
                
                console.log(`WRITING WAV FILE TO DISK WITH NAME: ${fileName}`);
                promises.writeFile(fileName, Buffer.from(encoded))
                .then(() => {
                    console.log('CONVERTING WAV FILE TO MP3...');
                    convertWavToMp3(fileName)
                    .then(() => {
                        console.log('DELETING WAV FILE...');
                        promises.rm(fileName);
                        resolve(`SECTION ${title} CREATED...`);
                    }).catch((err) => {
                        reject(err);
                    })
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        } catch (err) {
            reject(err);
        }
    });
}

const execPromisesSequentially = async (fnPromiseArr: Function[]): Promise<void> => {
    //exec Promises sequentially to rate limit the server calls
    let count = 0;

    while (fnPromiseArr.length > count) {
        try {

            await fnPromiseArr[count]();
            count++;
          } catch(err) {
            if (err instanceof Error) {
                console.error(err.message);
            }
            count++;
            continue;
          }
    }
}

const convertTextToAudio = async ({ textData, bookName, voice }: {
    textData: Array<AudioSection>;
    bookName: string;
    voice: string;
}): Promise<void> => {
    const audiobookDir = `./audiobooks/${bookName}.${randomAlphaNumeric(13)}`;
    try {
        await promises.mkdir(audiobookDir);

        const sectionChunks = chunkTextData(textData);

        const promiseFunctions: Function[] = sectionChunks.map((section: AudioSection) => {
            return createAudioFilePromise({section, audiobookDir, voice});
        });

        await execPromisesSequentially(promiseFunctions);
    } catch (err) {
        console.log({ err });
        console.error('could not generate audiobook...');
        process.exit(1);
    }
}

const convertWavToMp3 = (wavFilename) => {
    return new Promise((resolve, reject) => {
        const outputFile = wavFilename.replace('.wav', '.mp3');

        ffmpeg(wavFilename)
        .toFormat('mp3')
        .on('error', (err) => reject(err))
        .on('end', () => resolve(outputFile))
        .save(outputFile);
    });
}

export const createAudiobook = async () => {
    try {
        let start, end, total = 0;

        start = performance.now();
        const { filePath, voice } = fetchUserInput();
        end = performance.now();
        total += end - start;
        console.log(`Fetch user input took: ${(end - start) / 1000} seconds`);

        start = performance.now();
        const bookName = getBookNameFromFilePath(filePath);
        end = performance.now();
        total += end - start;
        console.log(`Getting book name from file path took: ${(end - start) / 1000} seconds`);

        start = performance.now();
        const textData = await fetchDataFromEpub(filePath) as Array<AudioSection>;
        end = performance.now();
        total += end - start;
        console.log(`Fetching text data from epub took: ${(end - start) / 1000} seconds`);

        start = performance.now();
        await convertTextToAudio({ textData, bookName, voice });
        end = performance.now();
        total += end - start;
        console.log(`Converting text to audio took: ${(end - start) / 1000} seconds`);

        console.log(`Total application time - ${total / 1000} seconds`);
        console.log('audiobook generated, exiting...');
        process.exit();
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}