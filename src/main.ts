// Author: Ed Linero

import { 
    fetchDataFromEpub,
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
            await createAudiobook({ textData, bookName, language });
        }
    }
})();