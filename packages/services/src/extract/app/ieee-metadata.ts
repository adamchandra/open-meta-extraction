
export interface GlobalDocumentMetadata {
  title: string;
  abstract: string;
  authors: Author[];
  pdfPath: string;
}

export interface Author {
  name: string;
  firstName: string;
  lastName: string;
  affiliation: string;
}
