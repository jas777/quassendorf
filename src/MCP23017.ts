import i2c from "i2c-bus";

class MCP23017 {

  static MCP23017_IODIRA = 0x00;
  static MCP23017_IPOLA = 0x02;
  static MCP23017_GPINTENA = 0x04;
  static MCP23017_DEFVALA = 0x06;
  static MCP23017_INTCONA = 0x08;
  static MCP23017_IOCONA = 0x0a;
  static MCP23017_GPPUA = 0x0c;
  static MCP23017_INTFA = 0x0e;
  static MCP23017_INTCAPA = 0x10;
  static MCP23017_GPIOA = 0x12;
  static MCP23017_OLATA = 0x14;

  static MCP23017_IODIRB = 0x01;
  static MCP23017_IPOLB = 0x03;
  static MCP23017_GPINTENB = 0x05;
  static MCP23017_DEFVALB = 0x07;
  static MCP23017_INTCONB = 0x09;
  static MCP23017_IOCONB = 0x0b;
  static MCP23017_GPPUB = 0x0d;
  static MCP23017_INTFB = 0x0f;
  static MCP23017_INTCAPB = 0x11;
  static MCP23017_GPIOB = 0x13;
  static MCP23017_OLATB = 0x15;

  bus: i2c.I2CBus;

  smbus: number;
  address: number;

  GPIOA_value: number;
  GPIOB_value: number;

  constructor(
    smbus: number,
    address: number,
    gpioa_mode: number,
    gpiob_mode: number
  ) {
    this.smbus = smbus;
    this.address = address;

    this.bus = i2c.openSync(smbus);

    this.bus.writeByteSync(address, MCP23017.MCP23017_IODIRA, gpioa_mode);
    this.bus.writeByteSync(address, MCP23017.MCP23017_IODIRB, gpiob_mode);

    this.GPIOA_value = this.bus.readByteSync(address, MCP23017.MCP23017_GPIOA);
    this.GPIOB_value = this.bus.readByteSync(address, MCP23017.MCP23017_GPIOB);

    this.bus.writeByteSync(address, MCP23017.MCP23017_GPIOA, 0xFF);
    this.bus.writeByteSync(address, MCP23017.MCP23017_GPIOB, 0xFF);
  }

  updateByte(byte: number, bit: number, value: number) {
    if (value === 0) return byte & ~(1 << bit);
    else if (value === 1) return byte | (1 << bit);
    else return 0x00;
  }

  checkBit(byte: number, bit: number) {
    return byte & (1 << bit) ? 1 : 0;
  }

  toggle(pin: number) {
    if (this.readPin(pin) == 1) {
      this.writePin(pin, 0);
    } else {
      this.writePin(pin, 1);
    }
  }

  writePin(pin: number, value: any) {
    if (pin < 8) {
      this.GPIOA_value = this.updateByte(this.GPIOA_value, pin, value);
      this.bus.writeByteSync(this.address, MCP23017.MCP23017_GPIOA, this.GPIOA_value);
    } else {
      pin = pin - 8;
      this.GPIOB_value = this.updateByte(this.GPIOB_value, pin, value);
      this.bus.writeByteSync(this.address, MCP23017.MCP23017_GPIOB, this.GPIOB_value);
    }
  }

  writeSide(side: number, value: any) {
    if (side == MCP23017.MCP23017_GPIOA) {
      this.GPIOA_value = value;
      this.bus.writeByteSync(this.address, MCP23017.MCP23017_GPIOA, this.GPIOA_value);
    } else if (side == MCP23017.MCP23017_GPIOB) {
      this.GPIOB_value = value;
      this.bus.writeByteSync(this.address, MCP23017.MCP23017_GPIOB, this.GPIOB_value);
    }
  }

  readPin(pin: number) {
    if (pin < 8) {
      this.GPIOA_value = this.bus.readByteSync(this.address, MCP23017.MCP23017_GPIOA);
      return this.checkBit(this.GPIOA_value, pin);
    } else {
      pin = pin - 8;
      this.GPIOB_value = this.bus.readByteSync(this.address, MCP23017.MCP23017_GPIOB);
      return this.checkBit(this.GPIOB_value, pin);
    }
  }
}

export default MCP23017;
