// Author: Ed Linero

import { 
    fetchDataFromEpub,
    writeTextDataToFile,
    createAudiobook,
} from './logic';

(async () => {
    const filePath = process.argv[2];
    const language = process.argv[3];

    if (filePath && language) {
        const filePathArr = filePath.split('/');
        const bookName = filePathArr[filePathArr.length - 1];

        const textData = await fetchDataFromEpub(filePath);

        if (textData && textData.length && textData.length > 0) {
            const textFilePath = await writeTextDataToFile({ textData, bookName });

            if (textFilePath) await createAudiobook({ textFilePath, language });
        }
    }
})();