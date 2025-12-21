import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const Navbar = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200 relative"
    >
      {/* Moving glowing line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
        <motion.div
          className="absolute h-full w-32 bg-gradient-to-r from-transparent via-black to-transparent"
          animate={{
            x: ["-128px", "95vw"],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
          style={{
            boxShadow: "0 0 10px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 0, 0, 0.1)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-3">
            <a href="/" className="flex flex-row gap-3 items-center">
              <img
                src="/logo.jpg"
                alt="Logo"
                className="w-12 h-12 flex items-center justify-center object-contain rounded-full"
              />
              <span className="text-xl font-bold bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 bg-clip-text text-transparent">
                Aion
              </span>
            </a>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <motion.button
              onClick={() => navigate("/borrow")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-2 text-gray-600 hover:text-black transition-colors duration-300 font-medium"
            >
              Borrow
            </motion.button>
            <motion.button
              onClick={() => navigate("/lend/deposit")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-2 text-gray-600 hover:text-black transition-colors duration-300 font-medium"
            >
              Lend
            </motion.button>
            <motion.button
              onClick={() => navigate("/waitlist")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-2 bg-gradient-to-r from-black to-gray-800 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-black/40 transition-all duration-300"
            >
              Waitlist
            </motion.button>

            {/* Social Media Icons */}
            <div className="flex gap-3 ml-4 pl-4 border-l border-gray-300">
              <motion.a
                href="https://x.com/aion_org"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-black transition-all duration-300"
                aria-label="Follow Aion on Twitter"
                title="Follow us on X (Twitter)"
              >
                <span className="text-xs font-bold">𝕏</span>
              </motion.a>
              <motion.a
                href="https://www.instagram.com/aion_org/"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-black transition-all duration-300"
                aria-label="Follow Aion on Instagram"
                title="Follow us on Instagram"
              >
                <span className="text-xs font-bold">IG</span>
              </motion.a>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            whileTap={{ scale: 0.95 }}
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 space-y-1"
            aria-label="Toggle mobile menu"
          >
            <motion.span
              animate={{ rotate: isMenuOpen ? 45 : 0, y: isMenuOpen ? 6 : 0 }}
              className="w-6 h-0.5 bg-gray-800 block transition-all"
            />
            <motion.span
              animate={{ opacity: isMenuOpen ? 0 : 1 }}
              className="w-6 h-0.5 bg-gray-800 block transition-all"
            />
            <motion.span
              animate={{ rotate: isMenuOpen ? -45 : 0, y: isMenuOpen ? -6 : 0 }}
              className="w-6 h-0.5 bg-gray-800 block transition-all"
            />
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{
          height: isMenuOpen ? "auto" : 0,
          opacity: isMenuOpen ? 1 : 0
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="md:hidden overflow-hidden bg-white/95 backdrop-blur-xl border-t border-gray-200"
      >
        <div className="px-4 py-6 space-y-4">
          <motion.button
            onClick={() => {
              navigate("/borrow");
              setIsMenuOpen(false);
            }}
            whileTap={{ scale: 0.95 }}
            className="w-full text-left px-4 py-3 text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-all duration-300 font-medium"
          >
            Borrow
          </motion.button>

          <motion.button
            onClick={() => {
              navigate("/lend/deposit");
              setIsMenuOpen(false);
            }}
            whileTap={{ scale: 0.95 }}
            className="w-full text-left px-4 py-3 text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-all duration-300 font-medium"
          >
            Lend
          </motion.button>

          <motion.button
            onClick={() => {
              navigate("/waitlist");
              setIsMenuOpen(false);
            }}
            whileTap={{ scale: 0.95 }}
            className="w-full px-4 py-3 bg-gradient-to-r from-black to-gray-800 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-black/40 transition-all duration-300"
          >
            Waitlist
          </motion.button>

          {/* Mobile Social Media Icons */}
          <div className="flex justify-center gap-4 pt-4 border-t border-gray-200">
            <motion.a
              href="https://x.com/aion_org"
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-black transition-all duration-300"
              aria-label="Follow Aion on Twitter"
              title="Follow us on X (Twitter)"
            >
              <span className="text-sm font-bold">𝕏</span>
            </motion.a>
            <motion.a
              href="https://www.instagram.com/aion_org/"
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-black transition-all duration-300"
              aria-label="Follow Aion on Instagram"
              title="Follow us on Instagram"
            >
              <span className="text-sm font-bold">IG</span>
            </motion.a>
          </div>
        </div>
      </motion.div>
    </motion.nav>
  );
};

export default Navbar;
