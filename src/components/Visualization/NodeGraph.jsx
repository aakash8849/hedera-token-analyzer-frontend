import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createColorScale, getNodeCategory } from '../../utils/d3Utils';

function NodeGraph({ data }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data?.nodes?.length) return;

    // D3 visualization code here (keep existing code)
    
  }, [data]);

  return <svg ref={svgRef} className="w-full h-screen" />;
}

export default NodeGraph;