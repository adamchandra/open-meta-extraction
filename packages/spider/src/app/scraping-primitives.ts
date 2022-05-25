//
// export const getElemOuterHtml: Transform<Elem, string> =
//   through((elem: Elem) => {
//     return pipe(
//       () => evalElemOuterHtml(elem),
//       TE.mapLeft((msg) => ['continue', msg]),
//     );
//   }, 'getElemOuterHtml');
