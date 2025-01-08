import { forwardRef , lazy, Suspense} from 'react'
const LazyCodeMirror = lazy(() =>
    import('react-codemirror2').then((module) => ({
      default: module.Controlled,
    }))
  );

const CodeMirrorWrapper = forwardRef(function CodeMirrorWrapper(props, ref) {
    if (typeof document === 'undefined') {
        return <></>
    }

    return (<Suspense fallback={<div>Loading...</div>}>
        <LazyCodeMirror {...props} ref={ref} />
    </Suspense>)
});

export default CodeMirrorWrapper