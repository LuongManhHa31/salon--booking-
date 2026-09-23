// Recursive character text splitter, phỏng theo RecursiveCharacterTextSplitter của LangChain:
// cắt ưu tiên theo ranh giới tự nhiên (đoạn văn -> câu -> khoảng trắng), giữ chunk_overlap
// giữa các đoạn liền kề để không mất ngữ cảnh tại điểm cắt.
const SEPARATORS = ["\n\n", ". ", " ", ""];

function splitBySeparator(text: string, separator: string): string[] {
  if (separator === "") return text.split("");
  return text.split(separator);
}

function mergeSplits(splits: string[], separator: string, chunkSize: number, chunkOverlap: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const piece of splits) {
    const pieceLen = piece.length + (current.length > 0 ? separator.length : 0);
    if (currentLen + pieceLen > chunkSize && current.length > 0) {
      chunks.push(current.join(separator));

      while (currentLen > chunkOverlap && current.length > 0) {
        currentLen -= current[0].length + separator.length;
        current.shift();
      }
    }
    current.push(piece);
    currentLen += pieceLen;
  }
  if (current.length > 0) chunks.push(current.join(separator));
  return chunks;
}

function recursiveSplit(text: string, separators: string[], chunkSize: number, chunkOverlap: number): string[] {
  if (text.length <= chunkSize) return [text];

  const [separator, ...rest] = separators;
  const splits = splitBySeparator(text, separator).filter((s) => s.length > 0);

  if (rest.length === 0) {
    return mergeSplits(splits, separator, chunkSize, chunkOverlap);
  }

  const merged = mergeSplits(splits, separator, chunkSize, chunkOverlap);
  return merged.flatMap((chunk) => (chunk.length > chunkSize ? recursiveSplit(chunk, rest, chunkSize, chunkOverlap) : [chunk]));
}

export function splitText(text: string, chunkSize = 350, chunkOverlap = 60): string[] {
  return recursiveSplit(text.trim(), SEPARATORS, chunkSize, chunkOverlap).filter((c) => c.trim().length > 0);
}
