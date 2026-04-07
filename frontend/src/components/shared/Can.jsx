import React from 'react';

const Can = ({ permission, children, fallback = null }) => {
  return permission ? children : fallback;
};

export default Can;
