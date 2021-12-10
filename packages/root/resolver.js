module.exports = (request, options) => {
  // Call the defaultResolver, so we leverage its cache, error handling, etc.
  console.log({ request });
  if (request.match('/src')) {
    // console.log({ options });
    // options.basedir = request;
    // options.paths.push(options.rootDir+'/../spider/node_modules/@watr/commonlib')
    // const resolved = options.defaultResolver(request, {
    //   ...options
    // });
    // console.log({ resolved, options });
    // const resolvedx = request.substring(0, request.length-3) + 'dist/index.js'
    const resolvedx = request.replace('/src', '/dist');
    console.log({ resolvedx });
    return resolvedx;
  }
  const resolved = options.defaultResolver(request, {
    ...options
  });
  console.log({ resolved });
  return resolved;
};
