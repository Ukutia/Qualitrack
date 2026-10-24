import { useEffect, useRef } from 'react';

export default function SelectionCheckbox({ indeterminate = false, ...props }) {
  const input = useRef(null);
  useEffect(() => { if (input.current) input.current.indeterminate = indeterminate; }, [indeterminate]);
  return <input {...props} ref={input} type="checkbox" className="repository-checkbox" />;
}
