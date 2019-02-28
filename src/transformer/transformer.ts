abstract class Transformer {
  public code: string;
  public sourceCode: string;
  public sourceFilePath: string;
  public destinationFilePath: string;
  public relativePath: string;
  public transform: () => void;
}

export default Transformer;
