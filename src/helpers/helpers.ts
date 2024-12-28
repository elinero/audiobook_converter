import { LANGUAGES } from "./languages";

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

export const getKeyFromLanguageMap = (input: string) => {
    const inverseLanguageMap = inverse(LANGUAGES);
    return inverseLanguageMap[getCapitalCase(input)];
} 

export const randomAlphaNumeric = (length: number) => {
    let s = '';
    Array.from({ length }).some(() => {
      s += Math.random().toString(36).slice(2);
      return s.length >= length;
    });
    return s.slice(0, length);
};