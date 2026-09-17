import React from 'react';

const BrandLogo = ({ width = 180, className = '', style, ...props }) => (
  <img src="/welgama-logo.svg" alt="Welgama Auto Parts" width={width} className={className} style={{ display: 'block', width, height: 'auto', ...style }} {...props} />
);

export default BrandLogo;
