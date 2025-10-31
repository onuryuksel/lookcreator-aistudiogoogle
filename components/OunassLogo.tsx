import React from 'react';
import { useBranding } from '../contexts/BrandingContext';

// The new Ounass logo provided by the user, converted to a base64 data URI to serve as a fallback.
const FALLBACK_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA+gAAADICAMAAACMy1sPAAAABlBMVEUAIAC7aj3AAAAAXRSTlMAQObYZgAAAwVJREFUeNrt3EFOwzAQRNFLH27i//9yTdAqKlQzxoBt7s0f0jmzSE0Trm0BAAAAAAAAAADcYnS/m80GAADg23f7W+3yAwAAd5D+b/3+AQAA/i79+gAAAAAAd5C+/gAAAADADfT1AQAAAADcAHD9AQAAAAC4Ab4+AAAAAABwA9w/gP6+3g+gv6/3A+jr/QL6+no/gL6+3g+gr/cL6Ovr/QD6+np/Q/r6eoA+vd4PoE+v9wPo0+v9APr0ej+APr3eD6BPr/cD6NPr/QD69Ho/gD693g+gT6/3A+jT6/0A+vR6P4A+vd4PoE+v9wPo0+v9APr0ej+APr3eD6BPr/cD6NPr/QD69Ho/gD693g+gT6/3A+jT6/0A+vR6P4A+vd4PoE+v9wPo0+v9APr0ej+APr3eD6BPr/cD6NPr/QD69Ho/gL5enw/09eX6gL6+XB/Q15frA/r6cn1AX1+uD+jry/UBfX25PqCvL9cH9PXl+oC+vlwf0NeX6wP6+nJ9QF9frg/o68v1AX19uT6gry/XB/T15fqAvr5cH9DXl+sD+vpyfUBfX64P6OvL9QF9fbl+QPr6eoA+vd4PoE+v9wPo0+v9APr0ej+APr3eD6BPr/cD6NPr/QD69Ho/gL6+nh+gry/XB/T15fqAvr5cH9DXl+sD+vpyfUBfX64P6OvL9QF9fbn+e+jr6/0A+vR6P4A+vd4PoE+v9wPo0+v9APr0ej+APr3eD6BPr/cD6NPr/QD69Hp/Q/r6eoA+vd4PoE+v9wPo0+v9APr0ej+APr3eD6BPr/cD6NPr/d+Bvr7eD6Cv9wvo6+v9APr6ej+Avr7eD6Cv9wvo6+v9APr6ej+Avr7eD6Cv9wvo6+v9APr6ej+Avr7eD6Cv9wvo6+v9APr6ej+Avr7eD6Cv9wvo6+v9APr6ej+Avr7eD6Cv9wvo6+v9APr6ej+Avr7eD6Cv9wvo6+v9APr6ej+Avr7eD6Cv9wvo6+v9APr6ej+Avr7eD6Cv9wvo6+v9APr6ej+Avr7eD6Cv9wvo6+v9APr6enx9AAAAAACA/4VvH51u0gAAAABJRU5ErkJggg==';

const OunassLogo: React.FC<{ className?: string }> = ({ className }) => {
  const { logoUrl } = useBranding();
  const src = logoUrl || FALLBACK_LOGO_BASE64;

  return <img src={src} alt="OUNASS Logo" className={className} />;
};

export default OunassLogo;
