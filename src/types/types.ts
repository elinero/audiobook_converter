// could be a chapter, the different sections that an epub is split into
export type AudioSection = {
    idx: number;
    title: string,
    content: string;
};

export type UserInputData = {
    filePath: string;
    voice: string;
}