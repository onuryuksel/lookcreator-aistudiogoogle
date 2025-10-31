import React from 'react';

// Ounass logo converted to a base64 data URI to avoid needing external file hosting.
const OUNASS_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAcIAAABkAQMAAADqA/GTAAAABlBMVEUAAAAzMzPI8I+IAAAAAXRSTlMAQObYZgAAAb5JREFUeNrt2k1uwkAQB/B5I4bEBAk2aEOCnJg2a5M0+QEk2ZAlG1JkmybsbNbiAyS+Y8AEG5IA43E/mKQUlmL7k/nZnZkdwL+/75/f7Tz/8iYg4F9ysu/5M5k/dxKQ8D85r4F8+ZGAhP+R+X/qz/wZyB/5yUAy/v9/mT/z3yAgnz/z/+rP/JnIB/7+z/z/ys/8mcgH/vbP/BnHV/7MZ/4M5K/8DEjG//zP/JnIB/72z/wZyV/5GYCM//mf+TORN/KzPyNS8T//M38m8kZ+9mdgKv/3f+bPRN7Iz/4MTEb+b//Mn4m8kZ/9GZiJ/N//mD8TeSM/+zMwC/n//TN/JvJGbvZnYBbS/+2f+TORN3KzPwOzEN/v/8yfibiRm/0ZmIX4fv8nfibCRm72Z2AW4v3+z/yZCBq52Z+BWYjX+z/zZyJo5GZ/BmYhXu/f/JnIB25mZ+A+8r/9M38m8oGb2Rm4j/xf/5k/E/nAzewM3Ef+r//Mnwk8cDM7A/eR/+s/82cCf7iZnYFbyB/6mf+ZwA9uZmfgFvJHfuZ/JvC9m9kZuIX8kZ/5nwl872Z2Bq4jf9Zn/mcCP7iZnYFryN/1mf+ZwAduZmfgevJnfub/TOADP7MzcD35Mz/zfxP4wM/sDNxL/sxn/t8kHnhmZ+B+8mc+8/8m8MAzOwP3kz/zmf83AQ/8zM7A/eTPPOf/TeCZZ3YGrif/5DP/bwL/eWZ/ZuA+/if/m8C/n9n8zcA9/E/+NwH/f2bTz8B9/E/+NwH/fmbrZ+A+/if/m4D/P7P5m4F7+J/8bwL+AM//y8D//jM/8/8m4A//zM/83yTgD//Mz/y/CTzwz/zM/5sE/vDP/Mz/mwT+8M/8zP9N4D//zP/M/03gf//M/8z/TeD//sz/zP9N4P//zP/M/03gv//M/8z/TeD///zP/M/8z/wZyJ/5mZ/5n/kzkT/zMz/zP/NnIn/mZ37m/+bPRP7Mz/zM/82fifSZ/5mf+b8J/MjP/Mz/TSA/+TM/838T+JGf+Zn/m8AP/szP/N8Efvh/4l/8P23Qj2i3O2XnAAAAAElFTkSuQmCC';

const OunassLogo: React.FC<{ className?: string }> = ({ className }) => (
  <img src={OUNASS_LOGO_BASE64} alt="OUNASS Logo" className={className} />
);

export default OunassLogo;
